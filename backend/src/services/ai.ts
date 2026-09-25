import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest, CognitiveLevel, QuestionType } from "@/types/assignments.js";
import { generateAssignmentContent } from "@/services/aiProvider.js";
import { LessonRepository } from "@/repositories/lesson.repository.js";
interface GeminiQuestionAnswer {
  content: string;
  isCorrect?: boolean;
}

interface GeminiQuestion {
  content: string;
  type: QuestionType;
  answer?: string;
  cognitive_level?: string;
  answers?: GeminiQuestionAnswer[];
}

interface GeminiAssignmentResponse {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  questions?: GeminiQuestion[];
}

interface LessonItem {
  id: number;
  lesson_number: number;
  title: string;
  content: string;
}

const VALID_LEVELS: CognitiveLevel[] = ["NB", "TH", "VD"];

function normalizeLevel(level: unknown, fallback: CognitiveLevel = "TH"): CognitiveLevel {
  return VALID_LEVELS.includes(level as CognitiveLevel) ? (level as CognitiveLevel) : fallback;
}

const AiService = {
  create: async (demand: AiRequest): Promise<AssignmentRequest> => {
    try {
      const {
        class_level,
        subject,
        title,
        description,
        time_duration,
        question_config,
      } = demand.data;

      const { groups } = question_config;

      if (!groups || groups.length === 0) {
        throw new Error("At least one question group is required");
      }

      // ==========================================
      // 2. Lấy tất cả lessonIds từ các groups
      // ==========================================

      const allLessonIds = [
        ...new Set(groups.flatMap((group) => group.lessonIds)),
      ];

      if (allLessonIds.length === 0) {
        throw new Error("At least one lesson must be selected");
      }

      const lessons: LessonItem[] = await LessonRepository.findContentsByIds(allLessonIds);

      if (lessons.length !== allLessonIds.length) {
        const existingLessonIds = new Set(lessons.map((lesson: LessonItem) => lesson.id));

        const missingLessonIds = allLessonIds.filter(
          (id: number) => !existingLessonIds.has(id),
        );

        throw new Error(`Lessons not found: ${missingLessonIds.join(", ")}`);
      }

      // ==========================================
      // 5. Tạo Map để lấy lesson nhanh
      // ==========================================

      const lessonMap = new Map<number, LessonItem>(
        lessons.map((lesson: LessonItem) => [lesson.id, lesson]),
      );

      // ==========================================
      // 6. Tính tổng số câu hỏi
      // ==========================================

      const totalQuestions = groups.reduce(
        (total, group) => total + group.count,
        0,
      );

      // ==========================================
      // 7. Tạo nội dung từng group
      // ==========================================

      const questionDistribution = groups
        .map((group, index) => {
          const groupLessons = group.lessonIds.map((lessonId: number) => {
            const lesson = lessonMap.get(lessonId);
            if (!lesson) {
              throw new Error(`Lesson ${lessonId} not found`);
            }
            return `
Lesson ${lesson.lesson_number}
Title: ${lesson.title}

Content:
${lesson.content}
`;
          });

          return `
========================
GROUP ${index + 1}
========================

Number of questions:
${group.count}

Cognitive level:
${group.difficulty}

Question type:
${group.type}

SOURCE LESSONS:
${groupLessons.join("\n")}
`;
        })
        .join("\n");

      const prompt = `
You are an AI assistant specialized in creating educational assignments.

Your task is to generate a complete assignment based on the teacher's
requirements and the source lesson content provided for each question group.

========================
ASSIGNMENT INFORMATION
========================

Title:
${title}

Description:
${description ?? "No description provided"}

Class level:
${class_level}

Subject:
${subject}

Duration:
${time_duration} minutes

========================
QUESTION GROUPS
========================

${questionDistribution}

========================
GENERATION RULES
========================

1. Generate exactly ${totalQuestions} questions.
2. Follow the group distribution exactly (match count, difficulty/cognitive_level, and question_type of each group).
3. Questions must come only from the provided lesson content. Do not use external knowledge or unintroduced topics.
4. NUMERICAL ORIGINALITY & VARIATION (CHỐNG SAO CHÉP NGUYÊN VĂN BÀI TẬP VÍ DỤ):
   - When generating calculation questions based on example exercises, sample problems, or textbook scenarios in the source lesson, ABSOLUTELY DO NOT copy the exact numbers or verbatim wording from the lesson examples (e.g. if the lesson has an example with V1 = 100 cm³, T1 = 27 °C, p1 = 10⁵ Pa, YOU MUST alter the numerical parameters to fresh, realistic values such as V1 = 150 cm³, T1 = 30 °C, etc., or swap the knowns and unknowns).
   - Ensure the new numbers are physically meaningful, realistic for the educational grade level, and lead to clean numerical calculations.

=========================================
COGNITIVE LEVEL GUIDELINES (STRICT COMPLIANCE)
=========================================
For each question, the 'cognitive_level' field MUST be exactly one of "NB", "TH", or "VD", conforming strictly to the pedagogical definitions below:

- NB (Nhận biết / Recognition & Recall):
  + The question must ONLY test direct memory, recall, or recognition of definitions, concepts, scientific laws, units of measurement, or formulas stated VERBATIM in the source lesson.
  + ABSOLUTELY NO numerical calculations, no formula manipulation, and no multi-step reasoning.
  + Typical question patterns: "Nêu...", "Phát biểu...", "Công thức nào sau đây...", "Đơn vị của [đại lượng] là gì?", "Theo bài học, đặc điểm nào sau đây...".

- TH (Thông hiểu / Comprehension & Explanation):
  + The question must require understanding the underlying physical/scientific principles, explaining causes/effects of phenomena ("Vì sao...", "Tại sao..."), comparing/contrasting concepts, or interpreting simple diagrams/graphs.
  + Calculation constraint: If a numerical calculation is required, it MUST BE AT MOST 1 SIMPLE STEP (direct substitution of given values into a single basic formula, e.g., substituting into \\(V_1/T_1 = V_2/T_2\\) after converting Celsius to Kelvin).
  + DO NOT label 1-step substitution questions as VD.
  + DO NOT label pure formula recall or definition recall questions as TH (those must be NB).
  + STRICT RESTRICTION FOR TH GROUPS: When a question group specifies difficulty 'TH', ABSOLUTELY DO NOT generate questions that only ask students to recall a verbatim fact, factor, or definition from the lesson (e.g. asking "the constant depends on which factor" or "what is the value of R" is pure recall NB and MUST NOT appear in a TH group). Questions in a TH group MUST genuinely require explanation ("Vì sao..."), comparison between two states, or a 1-step calculation.

- VD (Vận dụng / Application & Multi-step Solving):
  + The question must require logical synthesis, combining 2 or more calculation steps / 2 or more distinct formulas (e.g. calculating volume from density \\(V = m/\\rho\\) first, then applying the ideal gas law; or solving a system of equations).
  + May involve complex unit conversions or applying knowledge to unfamiliar real-world problem scenarios not described verbatim in the lessons.

=========================================
DISTRACTOR QUALITY RULES (FOR MULTIPLE CHOICE) - STRICT PEDAGOGICAL STANDARDS
=========================================
- For SINGLE_CHOICE and MULTIPLE_CHOICE: All incorrect options (distractors) must be HIGHLY PLAUSIBLE and constructed around real, specific student misconceptions and typical procedural errors:
  + Calculation distractors: MUST be derived from specific common errors (e.g. forgetting to convert Celsius to Kelvin T = t + 273, inverting formula ratios such as V1/V2 instead of V2/V1, omitting square roots, sign confusion in work/heat formulas ΔU = A + Q, or decimal place/unit prefix errors).
  + Conceptual/theoretical distractors ("Vì sao...", "Tại sao...", "Nhận định nào sau đây đúng/sai..."): MUST be credible, grammatically coherent statements written with formal scientific terminology. They must sound persuasive to a student with incomplete understanding (e.g. confusing macroscopic temperature with microscopic molecular kinetic energy, confusing volume expansion with mass change).
- ABSOLUTELY NO obviously absurd, comical, or trivially eliminable options (e.g. "phân tử biến mất", "thể tích trở về 0", or bringing up unrelated phenomena). Every option must be a serious academic choice.
- EQUAL LENGTH AND COMPLEXITY: All options must have comparable length, linguistic complexity, and grammatical structure. The correct answer must NOT be noticeably longer or more detailed than the distractors.
- For formula or unit questions: Distractors MUST have the exact same structural representation, mathematical symbols, or units as the correct answer (e.g. inverted fractions, alternative plausible variables from the same lesson).
- ABSOLUTELY NO two options that carry the exact same meaning (e.g. "càng giảm" and "càng chậm").
- Ensure exactly 1 unambiguously correct option for SINGLE_CHOICE.

=========================================
QUESTION TYPE FORMAT RULES
=========================================
4. SINGLE_CHOICE: Must have 'answers' array with at least 2 options, exactly 1 having isCorrect = true.
5. MULTIPLE_CHOICE: Must have 'answers' array with at least 2 options, at least 1 having isCorrect = true.
6. TRUE_FALSE: Must have 'answer' as "true" or "false", and 'answers' as [].
7. SHORT_ANSWER: Must have 'answer' containing the concise final answer string (e.g. "10 L" or "25"), and 'answers' as [].
8. Do not generate duplicate or near-duplicate questions.
9. Format all mathematical expressions, chemical formulas, and scientific notations using standard LaTeX syntax (e.g., use \\( ... \\) for inline formulas and \\[ ... \\] for display math equations). Ensure plain text and formulas are cleanly formatted.
10. Do not include any extra fields beyond the schema.
11. Return only JSON.

Generate the assignment now.
`;

      const jsonText = await generateAssignmentContent(prompt);
      const raw = JSON.parse(jsonText) as GeminiAssignmentResponse;
      const normalized: AssignmentRequest = {
        title: raw.title,
        description: raw.description,
        class_level: raw.class_level,
        duration_minutes: raw.duration_minutes,
        subject: raw.subject,
        lessonIds: allLessonIds,
        questions: (raw.questions || []).map((q: GeminiQuestion) => ({
          content: q.content,
          question_type: q.type,
          ...(q.answer ? { answer: q.answer } : {}),
          cognitive_level: normalizeLevel(q.cognitive_level),
          answers: (q.answers || []).map((a: GeminiQuestionAnswer) => ({
            content: a.content,
            isCorrect: Boolean(a.isCorrect),
          })),
        })),
      };

      return normalized;
    } catch (error) {
      console.error("AI Service - generate assignment error:", error);
      throw error;
    }
  },
};

export default AiService;

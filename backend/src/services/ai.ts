import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest, CognitiveLevel, QuestionType } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";
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
2. Follow the group distribution exactly.
3. Questions must come only from the provided lesson content.
4. Do not use external knowledge.
5. Every question must include a cognitive_level field and it must be exactly one of NB, TH, or VD.
6. Distribute questions according to the group cognitive levels.
7. Do not generate duplicate questions.
8. SINGLE_CHOICE and MULTIPLE_CHOICE must have answers.
9. TRUE_FALSE must have answer as true/false and answers as [].
10. SHORT_ANSWER must have answer string and answers as [].
11. Format all mathematical expressions, chemical formulas, and scientific notations using standard LaTeX syntax (e.g., use \\( ... \\) for inline formulas and \\[ ... \\] for display math equations). Ensure plain text and formulas are cleanly formatted.
12. Do not include any extra fields.
13. Return only JSON.

Generate the assignment now.
`;

      const response = await gemini.models.generateContent({
        model: process.env.MODEL || "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: assignmentAiSchema,
        },
      });

      

      if (!response.text) {
        throw new Error("Gemini returned an empty response");
      }

      const raw = JSON.parse(response.text) as GeminiAssignmentResponse;
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

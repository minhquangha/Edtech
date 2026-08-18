import pool from "@/config/db.js";
import type { AssignmentRequest } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";

interface PdfFileMeta {
  originalname: string;
  text: string;
}

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
type Difficulty = "easy" | "medium" | "hard";

interface QuestionGroup {
  type: QuestionType;
  count: number;
  difficulty: Difficulty;
}

interface GenerateFromPdfsParams {
  files: PdfFileMeta[];
  title?: string | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  classLevel?: string | undefined;
  durationMinutes?: number | undefined;
  questionGroups: QuestionGroup[];
  extraRequirements?: string | undefined;
  gradeId?: number | undefined;
}

function buildPrompt(params: GenerateFromPdfsParams): string {
  const {
    files,
    title,
    description,
    subject,
    classLevel,
    durationMinutes,
    questionGroups,
    extraRequirements,
  } = params;

  const sourceDocuments = files
    .map((file, index) => {
      return `
========================
SOURCE DOCUMENT ${index + 1}
Filename: ${file.originalname}
========================

${file.text}

`;
    })
    .join("\n");

  const totalQuestions = questionGroups.reduce((sum, g) => sum + g.count, 0);

  const groupDescriptions = questionGroups
    .map((g, i) => {
      const typeLabel =
        g.type === "SINGLE_CHOICE"
          ? "SINGLE_CHOICE (exactly ONE correct answer)"
          : g.type === "MULTIPLE_CHOICE"
            ? "MULTIPLE_CHOICE (at least ONE correct answer, may be multiple)"
            : g.type === "TRUE_FALSE"
              ? 'TRUE_FALSE (exactly 2 options: "Đúng" and "Sai", exactly ONE correct)'
              : "SHORT_ANSWER (answer field contains reference text, answers array is empty)";
      return `  Group ${i + 1}: ${g.count} questions, type = ${typeLabel}, difficulty = ${g.difficulty}`;
    })
    .join("\n");

  return `
You are an AI assistant specialized in creating educational assignments.

Your task is to generate a COMPLETE NEW assignment based ONLY on the content
of the source PDF documents provided below.

========================
ASSIGNMENT INFORMATION
========================

Title:
${title || "Auto-generated assignment from PDF"}

Description:
${description || "Assignment generated from imported PDF documents"}

Class level:
${classLevel || "Not specified"}

Subject:
${subject || "Not specified"}

Duration:
${durationMinutes || 30} minutes

========================
SOURCE PDF DOCUMENTS
========================

${sourceDocuments}

========================
QUESTION GROUPS
========================

The assignment contains exactly ${totalQuestions} questions divided into ${questionGroups.length} group(s):

${groupDescriptions}

Extra requirements from teacher:
${extraRequirements || "None"}

========================
GENERATION RULES
========================

1. Generate exactly ${totalQuestions} questions following the group specification above.

2. ALL questions must be based ONLY on the content from the source PDF
documents above.

3. Do NOT use any knowledge outside the provided documents.

4. Questions must be clear, educational, and unambiguous.

5. Do not generate duplicate questions.

6. For SINGLE_CHOICE questions:
   - There must be exactly ONE answer with isCorrect = true.
   - All other answers must have isCorrect = false.
   - At least 2 answer options.

7. For MULTIPLE_CHOICE questions:
   - There must be at least ONE answer with isCorrect = true.
   - There may be multiple correct answers.
   - At least 2 answer options.

8. For TRUE_FALSE questions:
   - There must be exactly 2 answer options: "Đúng" and "Sai".
   - Exactly ONE answer must have isCorrect = true.
   - The answer field should be "true" or "false".

9. For SHORT_ANSWER questions:
   - The answer field must contain the reference answer text.
   - The answers array must be empty.

10. Do not include the difficulty field in the question output.

11. Do not include any field that is not defined in the required JSON schema.

12. Do not include source document information in the final JSON.

13. Return only the assignment JSON.

14. Do not return markdown.

15. Do not return explanations before or after the JSON.

16. Make sure the total number of generated questions is exactly ${totalQuestions}.

Generate the assignment now.
`;
}

async function findLessonIds(
  gradeId: number | undefined,
  subjectName: string | undefined,
): Promise<number[]> {
  if (!gradeId) return [];

  const result = await pool.query(
    `
      SELECT l.id
      FROM "Lessons" l
      WHERE l.grade_id = $1
        ${subjectName ? `AND l.subject_id = (SELECT s.id FROM "Subjects" s WHERE s.subject = $2 LIMIT 1)` : ""}
      ORDER BY l.id
    `,
    subjectName ? [gradeId, subjectName] : [gradeId],
  );

  return result.rows.map((row) => Number(row.id));
}

function validateAssignmentRequest(
  data: unknown,
  lessonIds: number[],
): AssignmentRequest {
  if (!data || typeof data !== "object") {
    throw new Error("AI response is not a valid object");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== "string" || !obj.title.trim()) {
    throw new Error("AI response missing valid title");
  }

  if (typeof obj.description !== "string") {
    throw new Error("AI response missing valid description");
  }

  if (typeof obj.class_level !== "string") {
    throw new Error("AI response missing valid class_level");
  }

  if (
    typeof obj.duration_minutes !== "number" ||
    obj.duration_minutes <= 0
  ) {
    throw new Error("AI response missing valid duration_minutes");
  }

  if (typeof obj.subject !== "string") {
    throw new Error("AI response missing valid subject");
  }

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    throw new Error("AI response missing valid questions array");
  }

  const validTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"];

  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;

    if (typeof q.content !== "string" || !q.content.trim()) {
      throw new Error(`Question ${i + 1} missing valid content`);
    }

    const qType = (q.type ?? q.question_type) as string;
    if (!validTypes.includes(qType)) {
      throw new Error(
        `Question ${i + 1} has invalid question_type: ${qType}`,
      );
    }

    if (qType === "SHORT_ANSWER") {
      if (typeof q.answer !== "string" || !q.answer.trim()) {
        throw new Error(`Question ${i + 1} (SHORT_ANSWER) must have answer`);
      }
    } else if (qType === "TRUE_FALSE") {
      if (typeof q.answer !== "string" || (q.answer !== "true" && q.answer !== "false")) {
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          throw new Error(`Question ${i + 1} (TRUE_FALSE) must have answer or 2 options`);
        }
      }
    } else {
      if (!Array.isArray(q.answers) || q.answers.length < 2) {
        throw new Error(`Question ${i + 1} must have at least 2 answers`);
      }

      const hasCorrect = q.answers.some(
        (a: unknown) =>
          typeof a === "object" &&
          a !== null &&
          (a as Record<string, unknown>).isCorrect === true,
      );

      if (!hasCorrect) {
        throw new Error(`Question ${i + 1} has no correct answer`);
      }
    }
  }

  const assignment: AssignmentRequest = {
    title: obj.title,
    description: obj.description,
    class_level: obj.class_level,
    duration_minutes: obj.duration_minutes,
    subject: obj.subject,
    lessonIds,
    questions: (obj.questions as Array<Record<string, unknown>>).map(
      (q) => {
        const qType = (q.type ?? q.question_type) as QuestionType;

        const answers = (qType === "SHORT_ANSWER")
          ? []
          : (q.answers as Array<Record<string, unknown>>).map(
              (a) => ({
                content: a.content as string,
                isCorrect: a.isCorrect as boolean,
              }),
            );

        return {
          content: q.content as string,
          question_type: qType,
          ...(qType === "SHORT_ANSWER" || qType === "TRUE_FALSE"
            ? { answer: String(q.answer ?? (qType === "TRUE_FALSE" ? "true" : "")) }
            : {}),
          answers,
        };
      },
    ),
  };

  return assignment;
}

const PdfImportService = {
  generateFromPdfs: async (
    params: GenerateFromPdfsParams,
  ): Promise<AssignmentRequest> => {
    try {
      if (!params.files || params.files.length === 0) {
        throw new Error("No PDF files provided");
      }

      if (!params.questionGroups || params.questionGroups.length === 0) {
        throw new Error("No question groups provided");
      }

      for (const file of params.files) {
        if (!file.text || !file.text.trim()) {
          throw new Error(
            `File "${file.originalname}" has no extractable text layer. ` +
              "Please ensure the PDF is not a scanned image.",
          );
        }
      }

      const lessonIds = await findLessonIds(params.gradeId, params.subject);

      const prompt = buildPrompt(params);

      const response = await gemini.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: assignmentAiSchema,
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        throw new Error("Gemini returned invalid JSON");
      }

      const assignment = validateAssignmentRequest(parsed, lessonIds);

      return assignment;
    } catch (error) {
      console.error("PDF Import Service error:", error);
      throw error;
    }
  },
};

export default PdfImportService;

import type { AssignmentRequest } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";

interface PdfFileMeta {
  originalname: string;
  text: string;
}

interface GenerateFromPdfsParams {
  files: PdfFileMeta[];
  title?: string | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  classLevel?: string | undefined;
  durationMinutes?: number | undefined;
  questionCount?: number | undefined;
  questionType?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | undefined;
  difficulty?: "easy" | "medium" | "hard" | undefined;
  extraRequirements?: string | undefined;
}

function buildPrompt(params: GenerateFromPdfsParams): string {
  const {
    files,
    title,
    description,
    subject,
    classLevel,
    durationMinutes,
    questionCount,
    questionType,
    difficulty,
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

  const totalQuestions = questionCount && questionCount > 0 ? questionCount : 10;
  const qType = questionType || "SINGLE_CHOICE";
  const diff = difficulty || "medium";

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
QUESTION REQUIREMENTS
========================

The assignment contains exactly ${totalQuestions} questions.

Question type: ${qType}

Difficulty: ${diff}

Extra requirements from teacher:
${extraRequirements || "None"}

========================
GENERATION RULES
========================

1. Generate exactly ${totalQuestions} questions.

2. ALL questions must be based ONLY on the content from the source PDF
documents above.

3. Do NOT use any knowledge outside the provided documents.

4. Questions must be clear, educational, and unambiguous.

5. Do not generate duplicate questions.

6. Each question must contain multiple answer options.

7. Every answer option must contain:
   - content
   - isCorrect

8. For SINGLE_CHOICE questions:
   - There must be exactly ONE answer with isCorrect = true.
   - All other answers must have isCorrect = false.

9. For MULTIPLE_CHOICE questions:
   - There must be at least ONE answer with isCorrect = true.
   - There may be multiple correct answers.

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

function validateAssignmentRequest(
  data: unknown,
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

  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;

    if (typeof q.content !== "string" || !q.content.trim()) {
      throw new Error(`Question ${i + 1} missing valid content`);
    }

    const qType = (q.question_type ?? q.type) as string;
    if (qType !== "SINGLE_CHOICE" && qType !== "MULTIPLE_CHOICE") {
      throw new Error(
        `Question ${i + 1} has invalid question_type: ${qType}`,
      );
    }

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

  const assignment: AssignmentRequest = {
    title: obj.title,
    description: obj.description,
    class_level: obj.class_level,
    duration_minutes: obj.duration_minutes,
    subject: obj.subject,
    questions: (obj.questions as Array<Record<string, unknown>>).map(
      (q) => {
        const qType = (q.question_type ?? q.type) as
          | "SINGLE_CHOICE"
          | "MULTIPLE_CHOICE";

        return {
          content: q.content as string,
          question_type: qType,
          answers: (q.answers as Array<Record<string, unknown>>).map(
            (a) => ({
              content: a.content as string,
              isCorrect: a.isCorrect as boolean,
            }),
          ),
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

      for (const file of params.files) {
        if (!file.text || !file.text.trim()) {
          throw new Error(
            `File "${file.originalname}" has no extractable text layer. ` +
              "Please ensure the PDF is not a scanned image.",
          );
        }
      }

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

      const assignment = validateAssignmentRequest(parsed);

      return assignment;
    } catch (error) {
      console.error("PDF Import Service error:", error);
      throw error;
    }
  },
};

export default PdfImportService;

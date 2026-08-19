import pool from "@/config/db.js";
import type { AssignmentRequest } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";

interface PdfFileMeta {
  originalname: string;
  text: string;
}

type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
type CognitiveLevel = "NB" | "TH" | "VD";

interface QuestionGroup {
  type: QuestionType;
  count: number;
  difficulty: CognitiveLevel;
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
  const { files, title, description, subject, classLevel, durationMinutes, questionGroups, extraRequirements } = params;

  const sourceDocuments = files
    .map((file, index) => `
========================
SOURCE DOCUMENT ${index + 1}
Filename: ${file.originalname}
========================

${file.text}

`)
    .join("\n");

  const totalQuestions = questionGroups.reduce((sum, g) => sum + g.count, 0);
  const matrixSummary = questionGroups
    .map((g, i) => `- Nhóm ${i + 1}: ${g.count} câu | ${g.type} | mức độ ${g.difficulty}`)
    .join("\n");

  return `
Bạn là AI chuyên tạo bài tập giáo dục.

Nhiệm vụ của bạn là tạo MỘT BÀI TẬP MỚI dựa DUY NHẤT vào nội dung tài liệu PDF cung cấp bên dưới.

========================
THÔNG TIN BÀI TẬP
========================

Tiêu đề:
${title || "Auto-generated assignment from PDF"}

Mô tả:
${description || "Assignment generated from imported PDF documents"}

Lớp:
${classLevel || "Not specified"}

Môn:
${subject || "Not specified"}

Thời gian:
${durationMinutes || 30} phút

========================
TÀI LIỆU NGUỒN
========================

${sourceDocuments}

========================
MA TRẬN CÂU HỎI
========================

Tổng số câu: ${totalQuestions}

Các nhóm:
${matrixSummary}

Yêu cầu thêm của giáo viên:
${extraRequirements || "None"}

========================
QUY TẮC BẮT BUỘC
========================

1. Tạo đúng ${totalQuestions} câu hỏi.
2. Câu hỏi phải bám sát nội dung tài liệu nguồn, không dùng kiến thức ngoài.
3. Mỗi câu phải có đúng 1 mức độ nhận thức trong 3 mức: NB, TH, VD.
4. Tổng thể phải bám theo ma trận đã nêu.
5. Với SINGLE_CHOICE: đúng 1 đáp án đúng.
6. Với MULTIPLE_CHOICE: ít nhất 1 đáp án đúng.
7. Với TRUE_FALSE: chỉ có 2 lựa chọn Đúng/Sai và answer phải là true/false.
8. Với SHORT_ANSWER: answers phải rỗng, answer là đáp án ngắn.
9. Không sinh lại nguyên văn nội dung PDF.
10. Trả về chỉ JSON, không markdown, không giải thích.
11. Mỗi câu phải có trường cognitive_level với giá trị NB/TH/VD.
12. Không thêm field nào ngoài schema.

Hãy tạo bài tập ngay.
`;
}

async function findLessonIds(gradeId: number | undefined, subjectName: string | undefined): Promise<number[]> {
  if (!gradeId) return [];

  const result = await pool.query(
    `
      SELECT l.id
      FROM "Lessons" l
      WHERE l.grade_id = $1
        ${subjectName ? `AND l.subject_id = (SELECT s.id FROM "Subjects" s WHERE s.subject = $2 )` : ""}
      ORDER BY l.id
    `,
    subjectName ? [gradeId, subjectName] : [gradeId],
  );

  return result.rows.map((row) => Number(row.id));
}

function normalizeLevel(value: unknown): CognitiveLevel {
  if (value === "NB" || value === "TH" || value === "VD") return value;
  return "TH";
}

function validateAssignmentRequest(data: unknown, lessonIds: number[], expectedLevelCounts: Record<CognitiveLevel, number>): AssignmentRequest {
  if (!data || typeof data !== "object") {
    throw new Error("AI response is not a valid object");
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== "string" || !obj.title.trim()) throw new Error("AI response missing valid title");
  if (typeof obj.description !== "string") throw new Error("AI response missing valid description");
  if (typeof obj.class_level !== "string") throw new Error("AI response missing valid class_level");
  if (typeof obj.duration_minutes !== "number" || obj.duration_minutes <= 0) throw new Error("AI response missing valid duration_minutes");
  if (typeof obj.subject !== "string") throw new Error("AI response missing valid subject");
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) throw new Error("AI response missing valid questions array");

  const validTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"];
  const seenLevels: Record<CognitiveLevel, number> = { NB: 0, TH: 0, VD: 0 };

  for (let i = 0; i < obj.questions.length; i++) {
    const q = obj.questions[i] as Record<string, unknown>;
    if (typeof q.content !== "string" || !q.content.trim()) throw new Error(`Question ${i + 1} missing valid content`);

    const qType = (q.type ?? q.question_type) as string;
    if (!validTypes.includes(qType)) throw new Error(`Question ${i + 1} has invalid question_type: ${qType}`);

    const level = normalizeLevel(q.cognitive_level);
    seenLevels[level] += 1;

    if (qType === "SHORT_ANSWER") {
      if (typeof q.answer !== "string" || !q.answer.trim()) throw new Error(`Question ${i + 1} (SHORT_ANSWER) must have answer`);
    } else if (qType === "TRUE_FALSE") {
      if (typeof q.answer !== "string" || (q.answer !== "true" && q.answer !== "false")) {
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          throw new Error(`Question ${i + 1} (TRUE_FALSE) must have answer or 2 options`);
        }
      }
    } else {
      if (!Array.isArray(q.answers) || q.answers.length < 2) throw new Error(`Question ${i + 1} must have at least 2 answers`);
      const hasCorrect = q.answers.some((a: unknown) => typeof a === "object" && a !== null && (a as Record<string, unknown>).isCorrect === true);
      if (!hasCorrect) throw new Error(`Question ${i + 1} has no correct answer`);
    }
  }

  for (const level of ["NB", "TH", "VD"] as CognitiveLevel[]) {
    if (expectedLevelCounts[level] > 0 && seenLevels[level] === 0) {
      throw new Error(`AI response is missing questions for cognitive level ${level}`);
    }
  }

  return {
    title: obj.title as string,
    description: obj.description as string,
    class_level: obj.class_level as string,
    duration_minutes: obj.duration_minutes as number,
    subject: obj.subject as string,
    lessonIds: lessonIds,
    questions: (obj.questions as Array<Record<string, unknown>>).map((q) => {
      const qType = (q.type ?? q.question_type) as QuestionType;
      const answers = qType === "SHORT_ANSWER"
        ? []
        : (q.answers as Array<Record<string, unknown>>).map((a) => ({
            content: a.content as string,
            isCorrect: Boolean(a.isCorrect),
          }));

      if (qType === "SHORT_ANSWER") {
        return {
          content: q.content as string,
          question_type: qType,
          cognitive_level: normalizeLevel(q.cognitive_level),
          answer: typeof q.answer === "string" ? q.answer : "",
          answers,
        };
      }

      const question: any = {
        content: q.content as string,
        question_type: qType,
        cognitive_level: normalizeLevel(q.cognitive_level),
        answers,
      };

      if (typeof q.answer === "string") {
        question.answer = q.answer;
      }

      return question;
    }),
  };
}

const PdfImportService = {
  generateFromPdfs: async (params: GenerateFromPdfsParams): Promise<AssignmentRequest> => {
    try {
      if (!params.files || params.files.length === 0) throw new Error("No PDF files provided");
      if (!params.questionGroups || params.questionGroups.length === 0) throw new Error("No question groups provided");

      for (const file of params.files) {
        if (!file.text || !file.text.trim()) {
          throw new Error(`File "${file.originalname}" has no extractable text layer. Please ensure the PDF is not a scanned image.`);
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

      if (!response.text) throw new Error("Gemini returned an empty response");

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        throw new Error("Gemini returned invalid JSON");
      }

      const expectedLevelCounts: Record<CognitiveLevel, number> = { NB: 0, TH: 0, VD: 0 };
      for (const g of params.questionGroups) expectedLevelCounts[g.difficulty] += g.count;

      return validateAssignmentRequest(parsed, lessonIds, expectedLevelCounts);
    } catch (error) {
      console.error("PDF Import Service error:", error);
      throw error;
    }
  },
};

export default PdfImportService;

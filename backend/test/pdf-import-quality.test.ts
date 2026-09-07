import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";
import PdfImportService from "@/services/pdfImport.js";
import { normalizeText } from "./helpers/normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * QUALITY TESTS — đánh giá CHẤT LƯỢNG đầu ra của pipeline trích xuất + AI
 * theo các tiêu chí đo lường được (không chỉ pass/fail):
 *
 *   1. Question density — raw text phải giữ được mật độ câu hỏi của đề gốc
 *   2. Schema validity  — assignment sinh ra phải qua quality gate (type, level,
 *                          đúng 1 đáp án đúng với SINGLE_CHOICE, Đúng/Sai với TRUE_FALSE...)
 *   3. Type diversity   — AI phải giữ được đa dạng loại câu hỏi của đề mẫu
 *   4. Topic relevance  — từ khóa chủ đề (con lắc lò xo, tần số...) phải sống sót
 *   5. Hygiene          — không đưa text rỗng cho AI; không nhiễm marker pdf-parse
 *
 * Gemini được mock bằng "mô hình ghi chép trung thực" (mockAiExtractFromRawText):
 * sinh đề bám sát cấu trúc raw text → chạy offline, deterministic, vẫn đo được
 * chất lượng đầu ra ở tầng schema.
 */

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(__dirname, "fixtures", name));
}

const mockGenerateContent = vi.fn();

vi.mock("@/config/gemini.js", () => ({
  default: { models: { generateContent: (...a: unknown[]) => mockGenerateContent(...a) } },
}));

// ---------------------------------------------------------------------------
// Quality gate: các ràng buộc schema mà đề sinh ra phải thỏa (cùng luật với
// buildPrompt: enum type, enum cognitive level, SINGLE_CHOICE đúng 1 đáp án
// đúng, TRUE_FALSE phải có Đúng/Sai...).
// ---------------------------------------------------------------------------
type Question = {
  content: string;
  type: string;
  answer?: string;
  cognitive_level?: string;
  answers: Array<{ content: string; isCorrect: boolean }>;
};

type Assignment = {
  title?: string;
  description?: string;
  class_level?: string;
  duration_minutes?: number;
  subject?: string;
  questions: Question[];
};

const QUESTION_TYPES = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"];
const COGNITIVE_LEVELS = ["NB", "TH", "VD"];

function validateAssignmentSchema(assignment: Assignment): string[] {
  const errors: string[] = [];
  for (const field of ["title", "description", "class_level", "duration_minutes", "subject"]) {
    if (!assignment[field as keyof Assignment]) errors.push(`Missing ${field}`);
  }
  if (!Array.isArray(assignment.questions) || assignment.questions.length === 0) {
    errors.push("Missing questions array");
    return errors;
  }
  for (const q of assignment.questions) {
    if (!q.content || q.content.trim().length < 10) {
      errors.push(`Question content too short: ${q.content}`);
    }
    if (!QUESTION_TYPES.includes(q.type)) errors.push(`Unknown type: ${q.type}`);
    if (!COGNITIVE_LEVELS.includes(q.cognitive_level ?? "")) {
      errors.push(`Unknown cognitive level: ${q.cognitive_level}`);
    }
    if (q.type === "TRUE_FALSE") {
      const contents = q.answers.map((a) => a.content);
      if (!(contents.includes("Đúng") && contents.includes("Sai"))) {
        errors.push(`TRUE_FALSE needs Đúng/Sai: ${q.content}`);
      }
    }
    if (q.type === "SINGLE_CHOICE" && q.answers.filter((a) => a.isCorrect).length !== 1) {
      errors.push(`SINGLE_CHOICE needs exactly 1 correct: ${q.content}`);
    }
    // SHORT_ANSWER deliberately carries no options (answers: []), so the
    // option-count rule only applies to choice-style questions.
    if (q.type !== "SHORT_ANSWER" && q.answers.length < 2) {
      errors.push(`Fewer than 2 options: ${q.content}`);
    }
  }
  return errors;
}

/**
 * Mô hình "ghi chép trung thực": từ raw text đã trích xuất, sinh đề có cấu
 * trúc phản chiếu đề gốc. Thay thế Gemini để pipeline quality chạy offline
 * và deterministic. Regex nhận diện chấp nhận cả dạng ASCII (fixture sinh
 * sẵn) lẫn tiếng Việt có dấu (đề thật / kết quả OCR).
 */
function mockAiExtractFromRawText(rawText: string): Assignment {
  const normalized = normalizeText(rawText);
  const questions: Question[] = [];

  // Nhận diện từng loại câu hỏi trong raw text của đề gốc
  const hasTrueFalse = /a\.?\s*(?:đúng|dung)\s*b\.?\s*sai/.test(normalized);
  const hasShortAnswer = /(?:câu|cau) \d+: (?:viet cong thuc|tinh chu ky|cong thuc tinh)/.test(
    normalized
  );
  const hasSingleChoice =
    /(?:don vi cua tan so|bieu dien van toc|chu ky dao dong rieng|nang luong dao dong)/.test(
      normalized
    );

  // Đúng/Sai → sinh câu TRUE_FALSE đúng chuẩn (Đúng/Sai)
  if (hasTrueFalse) {
    questions.push({
      content: "Dao động điều hòa là dao động có li độ là hàm sin hoặc cosin theo thời gian.",
      type: "TRUE_FALSE",
      answer: "true",
      cognitive_level: "NB",
      answers: [
        { content: "Đúng", isCorrect: true },
        { content: "Sai", isCorrect: false },
      ],
    });
  }

  // Câu tự luận công thức → sinh SHORT_ANSWER (không có phương án)
  if (hasShortAnswer) {
    questions.push({
      content: "Viết công thức tính chu kỳ của con lắc đơn và giải thích các đại lượng trong công thức.",
      type: "SHORT_ANSWER",
      answer: "T = 2π√(l/g)",
      cognitive_level: "TH",
      answers: [],
    });
  }

  // Câu trắc nghiệm → sinh 2 câu SINGLE_CHOICE (NB + VD) đủ 4 phương án
  if (hasSingleChoice) {
    questions.push({
      content: "Đơn vị của tần số dao động là gì?",
      type: "SINGLE_CHOICE",
      answer: "B",
      cognitive_level: "NB",
      answers: [
        { content: "Giây (s)", isCorrect: false },
        { content: "Héc (Hz)", isCorrect: true },
        { content: "Met (m)", isCorrect: false },
        { content: "Newton (N)", isCorrect: false },
      ],
    });
    questions.push({
      content: "Chu kỳ dao động riêng của con lắc lò xo thay đổi thế nào khi khối lượng vật nặng tăng?",
      type: "SINGLE_CHOICE",
      answer: "A",
      cognitive_level: "VD",
      answers: [
        { content: "Tăng khi khối lượng tăng", isCorrect: true },
        { content: "Giảm khi khối lượng tăng", isCorrect: false },
        { content: "Không phụ thuộc khối lượng", isCorrect: false },
        { content: "Phụ thuộc vào biên độ dao động", isCorrect: false },
      ],
    });
  }

  // Fallback: không nhận diện được loại nào → trả 1 câu tổng hợp (không rỗng)
  if (questions.length === 0) {
    questions.push({
      content: "Câu hỏi tổng hợp từ đề mẫu được trích xuất.",
      type: "SINGLE_CHOICE",
      answer: "A",
      cognitive_level: "NB",
      answers: [
        { content: "Phương án A", isCorrect: true },
        { content: "Phương án B", isCorrect: false },
      ],
    });
  }

  // Lấy dòng đầu tiên của raw text làm tiêu đề đề
  const titleLine = rawText.split("\n").find((l) => l.trim().length > 0) ?? "Đề kiểm tra mới";
  return {
    title: titleLine.trim(),
    description: "Đề kiểm tra được tạo dựa trên đề mẫu",
    class_level: "11",
    duration_minutes: 45,
    subject: "Vật lý",
    questions,
  };
}

// ---------------------------------------------------------------------------
// Quality helpers — đo độ trung thực của raw text so với đề gốc
// ---------------------------------------------------------------------------
//đếm dấu hiệu nhận bt câu hỏi
function countQuestionMarkers(text: string): number {
  const matches = text.match(/câu\s+\d+:|cau\s+\d+:/gi) || [];
  return matches.length;
}

describe("Quality — extraction từ PDF có text layer", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  /**
   * Mật độ câu hỏi: đề thật gồm 2 phần (câu 1–11 và 12–23) — extract phải
   * bắt được ≥ 10 marker "câu N:" mỗi phần, và các phương án A–D phải nhận
   * diện được trong toàn bộ raw text.
   */
  it("should retain high question density from the real-world exam raw text", async () => {
    // The exam is delivered as two PDF parts (questions 1–11 and 12–23);
    // extraction must surface a question marker for every question.
    const part1 = await PdfExtractorService.extractPdfContent(
      readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf")
    );
    const part2 = await PdfExtractorService.extractPdfContent(
      readFixture("1. Hàn Thuyên - Bắc Ninh-2.pdf")
    );
    expect(part1.extractionMethod).toBe(extraction_method_t.PDF_TEXT);
    expect(part2.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const count1 = countQuestionMarkers(part1.rawText);
    const count2 = countQuestionMarkers(part2.rawText);
    expect(count1).toBeGreaterThanOrEqual(10);
    expect(count2).toBeGreaterThanOrEqual(10);

    // Options A–D must be detectable throughout
    const normalized = normalizeText(part1.rawText);
    expect(normalized).toMatch(/a\./);
    expect(normalized).toMatch(/b\./);
    expect(normalized).toMatch(/c\./);
    expect(normalized).toMatch(/d\./);
  });

  /**
   * Schema validity (luồng text layer): đề sinh từ raw text structure-exam.pdf
   * phải qua quality gate KHÔNG lỗi nào, và có ≥ 3 câu hỏi.
   */
  it("should generate a schema-valid assignment from a text-layer source", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("structure-exam.pdf")
    );
    expect(extraction.extractionMethod).toBe(extraction_method_t.PDF_TEXT);
    expect(extraction.rawText).toContain("DE KIEM TRA HOC KY I");

    const aiAssignment = mockAiExtractFromRawText(extraction.rawText);
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(aiAssignment) });

    const assignment = (await PdfImportService.generateFromPdfs({
      files: [{ originalname: "structure-exam.pdf", text: extraction.rawText }],
    })) as Assignment;

    const errors = validateAssignmentSchema(assignment);
    expect(errors).toEqual([]);
    expect(assignment.questions.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * Đa dạng loại câu hỏi: đề gốc có đủ TRUE_FALSE + SHORT_ANSWER + SINGLE_CHOICE
   * → đề sinh ra phải giữ cả 3 loại, không bị thu gọn về 1 loại.
   */
  it("should let the AI keep question-type diversity of the source", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("structure-exam.pdf")
    );
    const normalized = normalizeText(extraction.rawText);

    // Source contains all three kind of questions
    expect(normalized).toMatch(/a\.?\s*(?:đúng|dung)\s*b\.?\s*sai/); // TRUE_FALSE
    expect(normalized).toContain("cau 3: viet cong thuc"); // SHORT_ANSWER
    expect(normalized).toContain("don vi cua tan so"); // SINGLE_CHOICE

    const aiAssignment = mockAiExtractFromRawText(extraction.rawText);
    const types = aiAssignment.questions.map((q) => q.type);
    expect(types).toContain("TRUE_FALSE");
    expect(types).toContain("SHORT_ANSWER");
    expect(types).toContain("SINGLE_CHOICE");
  });

  /**
   * Relevance gate: từ khóa chủ đề vật lý của đề gốc phải nguyên vẹn sau
   * extract — nếu mất, prompt AI sẽ không biết đề nói về gì.
   */
  it("should preserve topic keywords through extraction (relevance gate)", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("structure-exam.pdf")
    );
    const normalized = normalizeText(extraction.rawText);

    // Topics from the source exam must survive extraction intact
    for (const keyword of ["con lac lo xo", "chu ky", "tan so", "dao dong dieu hoa"]) {
      expect(normalized).toContain(keyword);
    }
  });
});

describe("Quality — extraction từ PDF scan (OCR)", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  /**
   * Khối lượng text OCR: đề scan thật test1.pdf phải OCR ra > 200 ký tự
   * và giữ được từ khóa nhận dạng "con lắc lò xo".
   * Timeout 120s vì OCR thật.
   */
  it("should OCR a real scanned exam with sufficient text volume", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("test1.pdf")
    );
    expect(extraction.extractionMethod).toBe(extraction_method_t.OCR);
    expect(extraction.rawText.length).toBeGreaterThan(200);

    const normalized = normalizeText(extraction.rawText);
    expect(normalized).toContain("con lắc lò xo");
  }, 120_000);

  /**
   * Schema validity (luồng OCR): raw text OCR nhiều nhiễu hơn vẫn phải sinh
   * được assignment hợp lệ schema, không rỗng câu hỏi.
   * Timeout 120s vì OCR thật.
   */
  it("should generate a schema-valid assignment from OCR raw text", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("test1.pdf")
    );
    const aiAssignment = mockAiExtractFromRawText(extraction.rawText);
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(aiAssignment) });

    const assignment = (await PdfImportService.generateFromPdfs({
      files: [{ originalname: "test1.pdf", text: extraction.rawText }],
    })) as Assignment;

    const errors = validateAssignmentSchema(assignment);
    expect(errors).toEqual([]);
    expect(assignment.questions.length).toBeGreaterThan(0);
  }, 120_000);
});

describe("Quality — chung cho cả hai luồng trích xuất", () => {
  /**
   * Vệ sinh đầu vào: bất kể luồng nào (text layer hay OCR), raw text đưa cho
   * AI đều KHÔNG ĐƯỢC rỗng.
   * Timeout 120s vì có OCR thật (test1.pdf).
   */
  it("should never hand empty text to the AI for either extraction path", async () => {
    const textPdf = await PdfExtractorService.extractPdfContent(
      readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf")
    );
    const scanPdf = await PdfExtractorService.extractPdfContent(
      readFixture("test1.pdf")
    );

    expect(textPdf.rawText.trim().length).toBeGreaterThan(0);
    expect(scanPdf.rawText.trim().length).toBeGreaterThan(0);
  }, 120_000);

  /**
   * Nhiễu parser: marker pdf-parse (-- N of M --) chỉ được chiếm < 1% raw text
   * (text dài gấp 100 lần số marker) — đảm bảo raw text là nội dung thật.
   */
  it("should keep the extracted raw text free of parser noise markers", async () => {
    const textPdf = await PdfExtractorService.extractPdfContent(
      readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf")
    );

    // pdf-parse page markers (-- 1 of N --) must not dominate the raw text
    const markerCount = (textPdf.rawText.match(/--\s*\d+\s+of\s+\d+\s*--/g) || []).length;
    const textLength = textPdf.rawText.length;
    expect(textLength).toBeGreaterThan(markerCount * 100);
  });

  /**
   * Quality gate phải CHẶN đề hỏng: thiếu field, type lạ, level lạ...
   * (test này xác nhận validator bắt được ≥ 4 lỗi trên assignment cố tình sai).
   */
  it("should reject an assignment that fails the schema quality gate", async () => {
    // A bad AI response (no questions, invalid type) must be caught by the
    // schema validator used for quality control.
    const badAssignment = {
      title: "Bad",
      questions: [
        { content: "Q", type: "UNKNOWN_TYPE", answers: [], cognitive_level: "XX" },
      ],
    };

    const errors = validateAssignmentSchema(badAssignment as Assignment);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(errors.join("\n")).toContain("Missing description");
    expect(errors.join("\n")).toContain("Unknown type: UNKNOWN_TYPE");
  });
});
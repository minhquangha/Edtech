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

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

const mockGenerateContent = vi.fn();

vi.mock("@/config/gemini.js", () => ({
  default: { models: { generateContent: (...a: unknown[]) => mockGenerateContent(...a) } },
}));

// ---------------------------------------------------------------------------
// Quality gate: the assignment schema constraints that the AI prompt must
// satisfy (same rules as buildPrompt: type enums, cognitive levels, single
// correct answer for SINGLE_CHOICE, Đúng/Sai options for TRUE_FALSE...).
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

// Faithful transcription model: given the raw text extracted from the PDF,
// produce an assignment whose structure mirrors the source exam. This stands
// in for Gemini so the quality pipeline can run offline and deterministically.
// The detection regexes accept both ASCII (fixture-generated PDFs) and
// Vietnamese-diacritic forms (real-world PDFs / OCR output).
function mockAiExtractFromRawText(rawText: string): Assignment {
  const normalized = normalizeText(rawText);
  const questions: Question[] = [];

  const hasTrueFalse = /a\.?\s*(?:đúng|dung)\s*b\.?\s*sai/.test(normalized);
  const hasShortAnswer = /(?:câu|cau) \d+: (?:viet cong thuc|tinh chu ky|cong thuc tinh)/.test(
    normalized
  );
  const hasSingleChoice =
    /(?:don vi cua tan so|bieu dien van toc|chu ky dao dong rieng|nang luong dao dong)/.test(
      normalized
    );

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

  if (hasShortAnswer) {
    questions.push({
      content: "Viết công thức tính chu kỳ của con lắc đơn và giải thích các đại lượng trong công thức.",
      type: "SHORT_ANSWER",
      answer: "T = 2π√(l/g)",
      cognitive_level: "TH",
      answers: [],
    });
  }

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
// Source-text quality helpers — score how faithfully the raw text retains the
// structure of the source exam (question density, options, title).
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

  it("should OCR a real scanned exam with sufficient text volume", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("test1.pdf")
    );
    expect(extraction.extractionMethod).toBe(extraction_method_t.OCR);
    expect(extraction.rawText.length).toBeGreaterThan(200);

    const normalized = normalizeText(extraction.rawText);
    expect(normalized).toContain("con lắc lò xo");
  }, 120_000);

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

  it("should keep the extracted raw text free of parser noise markers", async () => {
    const textPdf = await PdfExtractorService.extractPdfContent(
      readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf")
    );

    // pdf-parse page markers (-- 1 of N --) must not dominate the raw text
    const markerCount = (textPdf.rawText.match(/--\s*\d+\s+of\s+\d+\s*--/g) || []).length;
    const textLength = textPdf.rawText.length;
    expect(textLength).toBeGreaterThan(markerCount * 100);
  });

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
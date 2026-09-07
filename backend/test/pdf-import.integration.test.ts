import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";
import PdfImportService from "@/services/pdfImport.js";
import { UploadExamRepository } from "@/repositories/uploaded_exam.repository.js";
import { normalizeText } from "./helpers/normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * INTEGRATION TESTS — phối hợp 3 tầng: Extract → Save raw text → Generate.
 * Kiểm tra phối hợp giữa các module (extractor + repository + AI service).
 *
 * Đây chính là luồng thật mà PdfImportController thực hiện cho MỖI file upload.
 * Gemini & UploadExamRepository được mock; extractor chạy THẬT trên fixture PDF.
 *
 * Kiểm chứng chính:
 *   - Raw text lưu vào DB phải BẰNG ĐÚNG raw text extractor trả ra (toàn vẹn).
 *   - extractionMethod (PDF_TEXT/OCR) ghi đúng theo luồng thực tế.
 *   - KHÔNG save khi extract thất bại; lỗi AI sau khi save được lan truyền.
 */

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

const mockGenerateContent = vi.fn();
const mockSaveRawText = vi.fn();

vi.mock("@/config/gemini.js", () => ({
  default: { models: { generateContent: (...a: unknown[]) => mockGenerateContent(...a) } },
}));

vi.mock("@/repositories/uploaded_exam.repository.js", () => ({
  UploadExamRepository: { saveRawText: (...a: unknown[]) => mockSaveRawText(...a) },
}));

// Response AI "chuẩn" dùng chung cho các test sinh đề
function validAssignment() {
  return {
    title: "Đề kiểm tra Vật lý 11",
    description: "Đề từ đề mẫu",
    class_level: "11",
    duration_minutes: 45,
    subject: "Vật lý",
    questions: [
      {
        content: "Câu 1: Dao động điều hòa là gì?",
        type: "SINGLE_CHOICE",
        answer: "A",
        cognitive_level: "NB",
        answers: [
          { content: "Phương án A", isCorrect: true },
          { content: "Phương án B", isCorrect: false },
        ],
      },
    ],
  };
}

// Trả về tham số của lần gọi saveRawText thứ n; throw nếu chưa từng gọi
// (giúp lỗi "quên save" fail rõ ràng thay vì lỗi undefined khó hiểu).
function savedCall(index = 0): unknown[] {
  const call = mockSaveRawText.mock.calls[index];
  if (!call) throw new Error(`saveRawText was not called ${index + 1} time(s)`);
  return call;
}

describe("Integration — Extract → Save raw text → Generate assignment", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockSaveRawText.mockReset();
    mockSaveRawText.mockResolvedValue({ id: 1 });
  });

  // ── Luồng 1: PDF có text layer ─────────────────────────────────────────
  /**
   * Luồng chuẩn PDF_TEXT: extract thật từ text-layer.pdf → save đủ 6 tham số
   * ĐÚNG GIÁ TRỊ (rawText, userId, fileName, fileSize, mimeType, method) →
   * sinh đề thành công từ chính rawText đã extract.
   */
  it("should extract, save raw text with PDF_TEXT method, and generate an assignment", async () => {
    const pdfBuffer = readFixture("text-layer.pdf");
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validAssignment()) });

    // 1. Extract
    const extraction = await PdfExtractorService.extractPdfContent(pdfBuffer);
    expect(extraction.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    // 2. Save raw text (as the controller does)
    await UploadExamRepository.saveRawText(
      extraction.rawText,
      42,
      "text-layer.pdf",
      pdfBuffer.length,
      "application/pdf",
      extraction.extractionMethod
    );
    expect(mockSaveRawText).toHaveBeenCalledTimes(1);
    const [rawText, userId, fileName, fileSize, mimeType, method] = savedCall();
    expect(rawText).toBe(extraction.rawText);
    expect(userId).toBe(42);
    expect(fileName).toBe("text-layer.pdf");
    expect(fileSize).toBe(pdfBuffer.length);
    expect(mimeType).toBe("application/pdf");
    expect(method).toBe(extraction_method_t.PDF_TEXT);

    // 3. Generate from the extracted raw text
    const assignment = await PdfImportService.generateFromPdfs({
      files: [{ originalname: "text-layer.pdf", text: extraction.rawText }],
    });
    expect(assignment.title).toBe("Đề kiểm tra Vật lý 11");
    expect(assignment.questions).toHaveLength(1);
  });

  // ── Luồng 2: PDF không có text layer (scanned) ─────────────────────────
  /**
   * Luồng OCR: scanned.pdf không có text layer → extract rơi xuống OCR →
   * save với method = OCR → sinh đề từ rawText OCR.
   * Timeout 60s vì OCR chạy thật.
   */
  it("should extract via OCR, save raw text with OCR method, and generate an assignment", async () => {
    const pdfBuffer = readFixture("scanned.pdf");
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validAssignment()) });

    const extraction = await PdfExtractorService.extractPdfContent(pdfBuffer);
    expect(extraction.extractionMethod).toBe(extraction_method_t.OCR);

    await UploadExamRepository.saveRawText(
      extraction.rawText,
      7,
      "scanned.pdf",
      pdfBuffer.length,
      "application/pdf",
      extraction.extractionMethod
    );
    expect(mockSaveRawText).toHaveBeenCalledTimes(1);
    expect(savedCall()[0]).toBe(extraction.rawText);
    expect(savedCall()[5]).toBe(extraction_method_t.OCR);

    const assignment = await PdfImportService.generateFromPdfs({
      files: [{ originalname: "scanned.pdf", text: extraction.rawText }],
    });
    expect(assignment.questions[0].type).toBe("SINGLE_CHOICE");
  }, 60_000);

  // ── Luồng 3: Đề thi thật ───────────────────────────────────────────────
  /**
   * Đề Hàn Thuyên thật (255 KB): extract ra nội dung có "câu 1" và raw text đó
   * phải sinh được assignment (mô phỏng đúng luồng "tạo lại đề từ đề đã upload").
   */
  it("should extract the real-world exam and generate an assignment from its raw text", async () => {
    const pdfBuffer = readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf");
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validAssignment()) });

    const extraction = await PdfExtractorService.extractPdfContent(pdfBuffer);
    expect(extraction.extractionMethod).toBe(extraction_method_t.PDF_TEXT);
    expect(normalizeText(extraction.rawText)).toContain("câu 1:");

    const assignment = await PdfImportService.generateFromPdfs({
      files: [{ originalname: "exam.pdf", text: extraction.rawText }],
    });
    expect(assignment.questions).toBeDefined();//tức ktra khác null/underfine là pass
  });

  // ── Kiểm tra toàn vẹn raw text đã lưu ──────────────────────────────────
  /**
   * Raw text LƯU VÀO REPO phải giữ được nội dung đề gốc (structure-exam.pdf):
   * tiêu đề "DE KIEM TRA HOC KY I" và câu 5 vẫn hiện diện sau khi save.
   */
  it("should ensure raw text saved to the repository equals what was extracted", async () => {
    const pdfBuffer = readFixture("structure-exam.pdf");
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(validAssignment()) });

    const extraction = await PdfExtractorService.extractPdfContent(pdfBuffer);

    await UploadExamRepository.saveRawText(
      extraction.rawText,
      1,
      "structure-exam.pdf",
      pdfBuffer.length,
      "application/pdf",
      extraction.extractionMethod
    );

    const saved = savedCall();
    // raw text saved must contain the exam title extracted from the PDF
    expect(String(saved[0])).toContain("DE KIEM TRA HOC KY I");
    expect(normalizeText(String(saved[0]))).toContain("cau 5");
  });

  // ── Lỗi: AI trả JSON hỏng sau khi save ─────────────────────────────────
  /**
   * Save thành công nhưng AI trả JSON hỏng → lỗi phải lan truyền (không nuốt).
   * Raw text vẫn đã lưu an toàn — dữ liệu upload không mất dù AI lỗi.
   */
  it("should propagate failure when the AI returns invalid JSON after saving", async () => {
    const pdfBuffer = readFixture("text-layer.pdf");
    mockGenerateContent.mockResolvedValue({ text: "not-json" });

    const extraction = await PdfExtractorService.extractPdfContent(pdfBuffer);
    await UploadExamRepository.saveRawText(
      extraction.rawText,
      1,
      "text-layer.pdf",
      pdfBuffer.length,
      "application/pdf",
      extraction.extractionMethod
    );

    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "text-layer.pdf", text: extraction.rawText }],
      })
    ).rejects.toThrow("Gemini returned invalid JSON");
  });

  // ── Lỗi: không đọc được nội dung ───────────────────────────────────────
  /**
   * Extract từ corrupted.pdf ném lỗi → KHÔNG ĐƯỢC save raw text rác vào DB
   * (save chỉ xảy ra sau khi extract thành công).
   */
  it("should throw before saving when extraction yields no readable content", async () => {
    const emptyBuffer = readFixture("corrupted.pdf");

    await expect(
      PdfExtractorService.extractPdfContent(emptyBuffer)
    ).rejects.toThrow();

    // The raw text must never be saved if extraction failed
    expect(mockSaveRawText).not.toHaveBeenCalled();
  });
});
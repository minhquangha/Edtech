import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

/**
 * EDGE CASE TESTS — tình huống biên & dữ liệu hỏng khi trích xuất PDF.
 *
 * Mục tiêu: đảm bảo extractor KHÔNG BAO GIỜ làm crash process với input bất
 * thường — luôn throw lỗi mô tả rõ ràng hoặc fallback OCR một cách an toàn.
 *
 * Phạm vi 2 nhóm:
 *   1. Dữ liệu biên/hỏng (chạy thật trên fixture):
 *      buffer rỗng 0 byte, PDF trang trống, trang trắng, PDF corrupted,
 *      file text giả dạng PDF, PDF bị cắt cụt (truncated).
 *   2. Ranh giới phân loại phương thức (mock):
 *      chỉ-marker → OCR; text dài có nghĩa → PDF_TEXT; extract lỗi → OCR.
 */
describe("Edge Case Tests — PDF extraction boundary conditions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty / zero-size buffers ──────────────────────────────────────────

  /**
   * Buffer 0 byte: pdf-parse ném InvalidPDFException → pipeline phải throw.
   * Kỳ vọng: rejects.toThrow() — KHÔNG được trả rawText rỗng lặng lẽ (vì như
   * vậy tầng trên sẽ tưởng "PDF trắng" và xử lý sai).
   */
  it("should throw for a completely empty buffer (0 bytes)", async () => {
    // pdf-parse throws InvalidPDFException on empty buffer
    await expect(
      PdfExtractorService.extractPdfContent(Buffer.alloc(0))
    ).rejects.toThrow();
  });

  // ── Empty-page PDF ─────────────────────────────────────────────────────

  /**
   * PDF hợp lệ nhưng trang rỗng: text layer chỉ có marker → fallback OCR.
   * Đầu vào : empty-page.pdf (cấu trúc PDF chuẩn, content stream rỗng).
   * Kỳ vọng : method = OCR; OCR ảnh trắng ra rỗng nhưng vẫn còn marker
   *            "--- Trang 1 ---" của luồng OCR.
   */
  it("should fall back to OCR for a valid PDF with an empty page", async () => {
    // empty-page.pdf has a valid structure but empty content stream.
    // pdf-parse returns only page markers → hasMeaningfulText = false →
    // OCR fallback → tesseract on blank page returns empty → but the OCR
    // page markers ("--- Trang 1 ---") keep hasMeaningfulText = true.
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("empty-page.pdf")
    );
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("--- Trang 1 ---");
  });

  // ── Blank-page PDF ─────────────────────────────────────────────────────

  /**
   * Trang trắng (chỉ có lệnh vẽ "BT ET", không chữ): hành vi như trang rỗng.
   * Đầu vào : blank-page.pdf.
   * Kỳ vọng : method = OCR; rawText còn marker "--- Trang 1 ---".
   */
  it("should fall back to OCR for a blank page PDF", async () => {
    // Same as empty-page.pdf — OCR page markers make the result meaningful.
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("blank-page.pdf")
    );
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("--- Trang 1 ---");
  });

  // ── Corrupted PDF ──────────────────────────────────────────────────────

  /**
   * PDF hỏng (header chuẩn nhưng body lỗi): không parse được → throw.
   * Kỳ vọng: rejects.toThrow() — lỗi lan lên controller để trả HTTP 400.
   */
  it("should throw when processing a corrupted PDF", async () => {
    await expect(
      PdfExtractorService.extractPdfContent(readFixture("corrupted.pdf"))
    ).rejects.toThrow();
  });

  // ── Non-PDF plain text ─────────────────────────────────────────────────

  /**
   * File text thuần giả dạng PDF: không được OCR bừa hay trả rỗng.
   * Kỳ vọng: rejects.toThrow() — bảo vệ lớp trước Multer có thể lọt.
   */
  it("should throw when processing a plain-text file that is not a PDF", async () => {
    await expect(
      PdfExtractorService.extractPdfContent(readFixture("not-a-pdf.txt"))
    ).rejects.toThrow();
  });

  // ── hasMeaningfulText edge cases ───────────────────────────────────────

  /**
   * Ranh giới "meaningful" của hasMeaningfulText: toàn marker pdf-parse hoặc
   * whitespace → false (chính là điều kiện kích hoạt fallback OCR).
   */
  it("should not treat page markers alone as meaningful text", () => {
    expect(
      PdfExtractorService.hasMeaningfulText("-- 1 of 1 --\n-- 2 of 2 --")
    ).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("  ")).toBe(false);
  });

  // ── extractPdfText on unparseable input ────────────────────────────────

  /**
   * extractPdfText gọi pdf-parse thật với input text tự do → ném lỗi lên trên
   * (không tự nuốt lỗi để trả chuỗi rỗng).
   */
  it("should throw when pdf-parse cannot parse the input", async () => {
    await expect(
      PdfExtractorService.extractPdfText(Buffer.from("not a pdf at all"))
    ).rejects.toThrow();
  });

  // ── Descriptive error when both methods fail ───────────────────────────

  /**
   * Thông điệp lỗi khi cả 2 phương thức đều rỗng phải mô tả đủ cả 2 phương thức
   * đã thử — giúp debug và map đúng sang HTTP 400.
   */
  it("should throw a descriptive error when neither method yields content", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found in PDF using text extraction or OCR");
  });

  // ── Truncated PDF ──────────────────────────────────────────────────────

  /**
   * PDF bị cắt còn một nửa byte: KHÔNG ĐƯỢC crash process — hoặc parse được
   * một phần (rawText defined) hoặc throw Error bình thường.
   */
  it("should handle a truncated PDF gracefully (no crash)", async () => {
    const full = readFixture("text-layer.pdf");
    const truncated = full.subarray(0, Math.floor(full.length / 2));
    try {
      const result = await PdfExtractorService.extractPdfContent(truncated);
      expect(result.rawText).toBeDefined();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

/**
 * Nhóm 2 — xác định đúng phương thức trích xuất ở các ranh giới đầu vào.
 */
describe("Extraction method correctness on boundary inputs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Text layer chỉ có marker pdf-parse → phải fallback OCR, method = OCR
  it("should fall back to OCR when text extraction returns only markers", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue(
      "-- 1 of 1 --"
    );
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      "--- Trang 1 ---\nNoi dung OCR"
    );

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("Noi dung OCR");
  });

  // Text dài 2000 ký tự có nội dung thật → giữ PDF_TEXT, OCR không được gọi
  it("should keep PDF_TEXT when extraction returns long meaningful content", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue(
      "Cau 1: " + "x".repeat(2000)
    );
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("OCR");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);
    expect(ocrSpy).not.toHaveBeenCalled();
  });

  // Text extraction ném lỗi → OCR được gọi 1 lần và kết quả OCR được dùng
  it("should fall back to OCR when text extraction throws an error", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockRejectedValue(
      new Error("Parse error")
    );
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("--- Trang 1 ---\nOCR content");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
  });
});
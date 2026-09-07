import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { normalizeText } from "./helpers/normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * BỘ TEST NỀN MÓNG — Pipeline Trích Xuất PDF & OCR Fallback (TC01–TC08).
 *
 * File này là "nguồn chuẩn" cho các case cơ bản của PdfExtractorService;
 * các file pdf-extraction.unit/pdf-text/ocr chỉ bổ sung case chưa có ở đây.
 *
 * Phạm vi:
 *   TC01      : Trích xuất PDF có text layer (không cần OCR)
 *   TC02      : Fallback OCR khi PDF scan không có text layer
 *   TC03–TC04 : Xử lý lỗi — fallback OCR khi extract lỗi; throw khi cả 2 lỗi
 *   TC05–TC06 : Đề thi thật "Hàn Thuyên - Bắc Ninh" part 1 & 2 (text layer)
 *   TC07      : Đề scan thật test1.pdf chạy OCR thật (Tesseract, ngôn ngữ "vie")
 *   TC08      : Ký hiệu vật lý (π, λ, δ) và đơn vị đo (N/m, Hz, rad, cm)
 *
 * Lưu ý: TC07 chạy OCR thật nên chậm hơn hẳn unit test (vài giây).
 */
describe("PDF Text Extraction & OCR Fallback Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

  });

  /**
   * TC01 — Trích xuất PDF có text layer.
   * Đầu vào : fixture text-layer.pdf (PDF gốc có sẵn lớp văn bản).
   * Kỳ vọng : rawText không rỗng; extractionMethod = PDF_TEXT (không fallback
   *            OCR); nội dung "Cau 1" và 4 phương án a/b/c/d xuất hiện đầy đủ
   *            sau khi normalize (lowercase, gọn whitespace).
   */
  it("should extract text from PDF with text layer", async () => {
    const filePath = path.join(fixturesDir, "text-layer.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("cau 1");
    expect(normalized).toContain("phuong an a");
    expect(normalized).toContain("phuong an b");
    expect(normalized).toContain("phuong an c");
    expect(normalized).toContain("phuong an d");
  });

  /**
   * TC02 — PDF scan không có text layer → phải tự chuyển sang OCR.
   * Đầu vào : fixture scanned.pdf (chỉ chứa ảnh chụp, không có lớp văn bản).
   * Kỳ vọng : extractionMethod = OCR; rawText do OCR sinh ra, không rỗng.
   */
  it("should fallback to OCR when PDF has no text layer", async () => {
    const filePath = path.join(fixturesDir, "scanned.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
  });

  /**
   * TC03 — Text extraction lỗi (PDF hỏng nửa chừng) vẫn phải cứu được bằng OCR.
   * Đầu vào : buffer giả + mock extractPdfText ném lỗi, mock OCR trả nội dung.
   * Kỳ vọng : OCR được gọi đúng 1 lần; kết quả gán method = OCR; nội dung OCR
   *            ("cau 1 test fallback ocr") có trong rawText.
   */
  it("should fallback to OCR when PDF text extraction fails", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");

    vi.spyOn(PdfExtractorService, "extractPdfText").mockRejectedValue(
      new Error("PDF extraction failed")
    );
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("--- Trang 1 ---\nCau 1 test fallback OCR A B C D");

    const result = await PdfExtractorService.extractPdfContent(fakeBuffer);

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("cau 1 test fallback ocr");
  });

  /**
   * TC04 — Cả text extraction lẫn OCR đều lỗi → phải throw, không trả rỗng.
   * Đầu vào : buffer giả + mock cả 2 hàm đều ném lỗi.
   * Kỳ vọng : rejects với đúng lỗi của bước cuối (OCR): "OCR processing failed".
   */
  it("should throw error when both PDF extraction and OCR fail", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");

    vi.spyOn(PdfExtractorService, "extractPdfText").mockRejectedValue(
      new Error("PDF extraction failed")
    );
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockRejectedValue(
      new Error("OCR processing failed")
    );

    await expect(
      PdfExtractorService.extractPdfContent(fakeBuffer)
    ).rejects.toThrow("OCR processing failed");
  });

  /**
   * TC05 — Đề thi thật part 1: kiểm chứng ĐỘ CHÍNH XÁC nội dung trích xuất.
   * Đầu vào : "1. Hàn Thuyên - Bắc Ninh-1.pdf" (đề vật lý 11 thật, câu 1–11).
   * Kỳ vọng : method = PDF_TEXT; sau normalize, rawText chứa chính xác:
   *            tiêu đề đề, câu 1 (con lắc lò xo) + 4 phương án (1kg/500g/625g/50g),
   *            câu 2 (giao thoa sóng) và câu 10 (con lắc đơn).
   */
  it("should extract correct questions and options from real-world exam PDF part 1", async () => {
    const filePath = path.join(fixturesDir, "1. Hàn Thuyên - Bắc Ninh-1.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);

    // 1. Kiểm tra Tiêu đề đề thi
    expect(normalized).toContain("đề vật lý hàn thuyên - bắc ninh 2022-2023");

    // 2. Kiểm tra Câu 1 & Các phương án A, B, C, D
    expect(normalized).toContain("câu 1:");
    expect(normalized).toContain("con lắc lò xo gồm vật có khối lượngm");
    expect(normalized).toContain("a.1kg");
    expect(normalized).toContain("b. 500 g");
    expect(normalized).toContain("c.625 g");
    expect(normalized).toContain("d.50 g");

    // 3. Kiểm tra Câu 2
    expect(normalized).toContain("câu 2:");
    expect(normalized).toContain("điều nào sau đây là đúng khi nói về sự giao thoa sóng?");

    // 4. Kiểm tra Câu 10 (Chế độ lắc đơn)
    expect(normalized).toContain("câu 10:");
    expect(normalized).toContain("con lắc đơn dao động điều hòa với chu kỳ t. nếu giảm chiều dài dây xuống 2 lần và tăng khối lượng của vật nặng lên 4 lần");
  });

  /**
   * TC06 — Đề thi thật part 2: câu hỏi nằm sâu trong file vẫn phải đủ.
   * Đầu vào : "1. Hàn Thuyên - Bắc Ninh-2.pdf" (câu 12–23).
   * Kỳ vọng : method = PDF_TEXT; rawText chứa câu 12 + đủ 4 phương án năng lượng
   *            (0,8 J / 4,0 J / 4000,0 J / 0,4 J) và câu 23 (lực Lorenxo).
   */
  it("should extract correct questions and options from real-world exam PDF part 2", async () => {
    const filePath = path.join(fixturesDir, "1. Hàn Thuyên - Bắc Ninh-2.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);

    // 1. Kiểm tra Câu 12 & Các phương án lựa chọn A, B, C, D
    expect(normalized).toContain("câu 12:");
    expect(normalized).toContain("một con lắc lò xo gồm vật nặng và lò xo có độ cứng 80 n / m");
    expect(normalized).toContain("a. 0,8 j");
    expect(normalized).toContain("b. 4,0 j");
    expect(normalized).toContain("c. 4000,0 j");
    expect(normalized).toContain("d. 0,4 j");

    // 2. Kiểm tra Câu 23 (Lực Lorenxo)
    expect(normalized).toContain("câu 23:");
    expect(normalized).toContain("khi nói về lực lorenxo");
  });

  /**
   * TC07 — Đề scan THẬT chạy OCR THẬT (Tesseract, model "vie" — chạy chậm).
   * Đầu vào : fixture test1.pdf (~900 KB, đề thi vật lý scan ảnh).
   * Kỳ vọng : method = OCR; sau normalize, rawText giữ được nội dung nhận dạng
   *            được: "bác ninh 2022-2023" (từ "Bắc Ninh" bị OCR lệch) và
   *            "con lắc lò xo".
   */
  it("should process real-world scanned PDF via OCR", async () => {
    const filePath = path.join(fixturesDir, "test1.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("bác ninh 2022-2023");
    expect(normalized).toContain("con lắc lò xo");
  });

  /**
   * TC08 — Ký hiệu đặc biệt & đơn vị vật lý phải "sống sót" qua trích xuất.
   * Đầu vào : "1. Hàn Thuyên - Bắc Ninh-1.pdf" (chứa π, λ, δ, =, N/m, Hz, rad, cm).
   * Kỳ vọng : rawText khớp regex ký hiệu Toán (Pi/Lambda/Delta/dấu bằng) và sau
   *            normalize chứa đủ đơn vị — bảo đảm công thức không bị méo khi
   *            đưa vào prompt AI để sinh đề.
   */
  it("should successfully extract raw text with physics symbols and measurement units", async () => {
    const filePath = path.join(fixturesDir, "1. Hàn Thuyên - Bắc Ninh-1.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);
    const rawText = result.rawText;
    const normalized = normalizeText(rawText);

    // 1. Kiểm tra trích xuất đầy đủ văn bản chứa các ký hiệu toán/lý trong raw stream
    expect(rawText).toMatch(/|||/); // Pi (), Lambda (), Delta (), Dấu = ()

    // 2. Kiểm tra các đơn vị đo lường vật lý
    expect(normalized).toContain("n / m");
    expect(normalized).toContain("hz");
    expect(normalized).toContain("rad");
    expect(normalized).toContain("cm");
  });
});


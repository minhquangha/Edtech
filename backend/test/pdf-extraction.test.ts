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

describe("PDF Text Extraction & OCR Fallback Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

  });

  // TC01 — PDF có text layer
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

  // TC02 — PDF không có text layer (scanned PDF)
  it("should fallback to OCR when PDF has no text layer", async () => {
    const filePath = path.join(fixturesDir, "scanned.pdf");
    const pdfBuffer = fs.readFileSync(filePath);

    const result = await PdfExtractorService.extractPdfContent(pdfBuffer);

    expect(result.rawText).not.toBe("");
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
  });

  // TC03 — PDF text extraction bị lỗi → fallback OCR
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

  // TC04 — PDF extraction và OCR đều lỗi
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

  // TC05 — Trích xuất & Kiểm tra chính xác câu hỏi, phương án lựa chọn từ đề PDF thực tế (Phần 1)
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

  // TC06 — Trích xuất & Kiểm tra chính xác câu hỏi, phương án lựa chọn từ đề PDF thực tế (Phần 2)
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

  // TC07 — Trích xuất text từ file PDF scan thực tế bằng OCR (test1.pdf)
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

  // TC08 — Kiểm tra trích xuất raw text chứa ký hiệu đặc biệt và đơn vị Vật Lý (N/m, Hz, rad, cm)
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


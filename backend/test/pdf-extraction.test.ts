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
});

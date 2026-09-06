import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");
//Test các trường hợp bất thường ,các TH ở biên
function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

describe("Edge Case Tests — PDF extraction boundary conditions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Empty / zero-size buffers ──────────────────────────────────────────

  it("should throw for a completely empty buffer (0 bytes)", async () => {
    // pdf-parse throws InvalidPDFException on empty buffer
    await expect(
      PdfExtractorService.extractPdfContent(Buffer.alloc(0))
    ).rejects.toThrow();
  });

  // ── Empty-page PDF ─────────────────────────────────────────────────────

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

  it("should fall back to OCR for a blank page PDF", async () => {
    // Same as empty-page.pdf — OCR page markers make the result meaningful.
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("blank-page.pdf")
    );
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("--- Trang 1 ---");
  });

  // ── Corrupted PDF ──────────────────────────────────────────────────────

  it("should throw when processing a corrupted PDF", async () => {
    await expect(
      PdfExtractorService.extractPdfContent(readFixture("corrupted.pdf"))
    ).rejects.toThrow();
  });

  // ── Non-PDF plain text ─────────────────────────────────────────────────

  it("should throw when processing a plain-text file that is not a PDF", async () => {
    await expect(
      PdfExtractorService.extractPdfContent(readFixture("not-a-pdf.txt"))
    ).rejects.toThrow();
  });

  // ── hasMeaningfulText edge cases ───────────────────────────────────────

  it("should not treat page markers alone as meaningful text", () => {
    expect(
      PdfExtractorService.hasMeaningfulText("-- 1 of 1 --\n-- 2 of 2 --")
    ).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("  ")).toBe(false);
  });

  // ── extractPdfText on unparseable input ────────────────────────────────

  it("should throw when pdf-parse cannot parse the input", async () => {
    await expect(
      PdfExtractorService.extractPdfText(Buffer.from("not a pdf at all"))
    ).rejects.toThrow();
  });

  // ── Descriptive error when both methods fail ───────────────────────────

  it("should throw a descriptive error when neither method yields content", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found in PDF using text extraction or OCR");
  });

  // ── Truncated PDF ──────────────────────────────────────────────────────

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

describe("Extraction method correctness on boundary inputs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
import { describe, it, expect, vi, beforeEach } from "vitest";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { normalizeText } from "./helpers/normalize.js";

// ---------------------------------------------------------------------------
// hasMeaningfulText unit tests
// ---------------------------------------------------------------------------
describe("hasMeaningfulText — Unit Tests", () => {
  it("should return false for empty string", () => {
    expect(PdfExtractorService.hasMeaningfulText("")).toBe(false);
  });

  it("should return false for whitespace-only string", () => {
    expect(PdfExtractorService.hasMeaningfulText("   ")).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("\n\t  \n")).toBe(false);
  });

  it("should return false for string containing only page markers", () => {
    expect(PdfExtractorService.hasMeaningfulText("-- 1 of 1 --")).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("--  1 of  5 --")).toBe(false);
    expect(
      PdfExtractorService.hasMeaningfulText("-- 1 of 1 --\n-- 2 of 2 --")
    ).toBe(false);
  });

  it("should return false for string with only whitespace and markers", () => {
    expect(PdfExtractorService.hasMeaningfulText("  \n-- 1 of 1 --\n  ")).toBe(false);
  });

  it("should return true for string with actual text content", () => {
    expect(PdfExtractorService.hasMeaningfulText("Cau 1: De thi")).toBe(true);
  });

  it("should return true for text mixed with page markers", () => {
    const text = "Cau 1: Noi dung\n-- 1 of 1 --\n";
    expect(PdfExtractorService.hasMeaningfulText(text)).toBe(true);
  });

  it("should return true for single non-whitespace character", () => {
    expect(PdfExtractorService.hasMeaningfulText("a")).toBe(true);
    expect(PdfExtractorService.hasMeaningfulText("1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extractPdfText unit tests — verify the branching logic handles every result
// shape produced by pdf-parse (string | { text } | { pages } | empty).
// ---------------------------------------------------------------------------
describe("extractPdfText — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the string when pdf-parse returns a plain string", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("Raw string text");

    const result = await PdfExtractorService.extractPdfText(Buffer.from("fake"));
    expect(result).toBe("Raw string text");
  });

  it("should return empty string when pdf-parse produces nothing", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");

    const result = await PdfExtractorService.extractPdfText(Buffer.from("fake"));
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// extractPdfTextUsingOCR unit tests — verify OCR text structure and error
// propagation.
// ---------------------------------------------------------------------------
describe("extractPdfTextUsingOCR — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should produce page markers around OCR text", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      "--- Trang 1 ---\nCau 1: Noi dung OCR\n\n--- Trang 2 ---\nCau 2: Noi dung OCR\n\n"
    );

    const result = await PdfExtractorService.extractPdfTextUsingOCR(Buffer.from("fake"));
    expect(result).toContain("--- Trang 1 ---");
    expect(result).toContain("Cau 1: Noi dung OCR");
    expect(result).toContain("--- Trang 2 ---");
  });

  it("should return empty string for empty OCR result", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    const result = await PdfExtractorService.extractPdfTextUsingOCR(Buffer.from("fake"));
    expect(result).toBe("");
  });

  it("should propagate OCR failure", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockRejectedValue(
      new Error("OCR processing failed")
    );

    await expect(
      PdfExtractorService.extractPdfTextUsingOCR(Buffer.from("fake"))
    ).rejects.toThrow("OCR processing failed");
  });
});

// ---------------------------------------------------------------------------
// extractPdfContent unit tests — orchestration of text extraction + OCR
// fallback decision logic.
// ---------------------------------------------------------------------------
describe("extractPdfContent — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();//Khôi phục tất cả các mock/spy về trạng thái và implementation ban đầu.
  });

  it("should use PDF_TEXT method when text extraction succeeds", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("Cau 1: Text");
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("OCR fallback content");//Mock hàm extractPdfTextUsingOCR để trả về "OCR fallback content" khi dc gọi(hàm này k chạy mà trả về luôn)

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).not.toHaveBeenCalled();
    expect(result.extractionMethod).toBe("PDF_TEXT");
    expect(result.rawText).toContain("Cau 1: Text");
  });

  it("should fall back to OCR when extracted text is only page markers", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("-- 1 of 1 --");
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("--- Trang 1 ---\nNoi dung OCR tim duoc");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe("OCR");
    expect(normalizeText(result.rawText)).toContain("noi dung ocr tim duoc");
  });

  it("should fall back to OCR when extracted text is empty", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("--- Trang 1 ---\nText");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe("OCR");
  });

  it("should fall back to OCR when text extraction throws", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockRejectedValue(
      new Error("Corrupted PDF")
    );
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("OCR recovered content");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe("OCR");
  });

  it("should throw when text extraction succeeds but OCR returns only markers", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      "-- 1 of 1 --\n-- 2 of 2 --"
    );

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found");
  });

  it("should throw when both text extraction and OCR return empty", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found");
  });

  it("should throw when both text extraction and OCR fail", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockRejectedValue(
      new Error("PDF parse failure")
    );
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockRejectedValue(
      new Error("OCR process crashed")
    );

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("OCR process crashed");
  });

  it("should preserve meaningful text even when it contains page markers", async () => {
    const content =
      "Cau 1: Day la cau hoi that\n-- 1 of 1 --\nA. Phuong an dung";
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue(content);
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("OCR");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).not.toHaveBeenCalled();
    expect(result.extractionMethod).toBe("PDF_TEXT");
    expect(result.rawText).toContain("Day la cau hoi that");
  });
});

// ---------------------------------------------------------------------------
// normalizeText helper unit tests
// ---------------------------------------------------------------------------
describe("normalizeText — Unit Tests", () => {
  it("should normalize whitespace and lowercase text", () => {
    expect(normalizeText("  Cau 1:  ABC  ")).toBe("cau 1: abc");
  });

  it("should handle empty string", () => {
    expect(normalizeText("")).toBe("");
  });

  it("should handle multiple lines", () => {
    const result = normalizeText("Cau 1\nA. Option A\nB. Option B");
    expect(result).toBe("cau 1 a. option a b. option b");
  });
});
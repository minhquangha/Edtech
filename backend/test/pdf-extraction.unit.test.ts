import { describe, it, expect, vi, beforeEach } from "vitest";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { normalizeText } from "./helpers/normalize.js";

/**
 * UNIT TESTS — PdfExtractorService (kiểm tra từng hàm thuần, cô lập hoàn toàn).
 *
 * Toàn bộ phụ thuộc ngoài (pdf-parse, Tesseract OCR) đều được mock qua
 * vi.spyOn nên chạy rất nhanh (< 1s) và ổn định trên CI.
 *
 * Cấu trúc 5 nhóm:
 *   1. hasMeaningfulText      — logic phân loại "text có ý nghĩa" (7 test)
 *   2. extractPdfText         — xử lý kết quả trả về của pdf-parse (2 test)
 *   3. extractPdfTextUsingOCR — cấu trúc text OCR + lan truyền lỗi (3 test)
 *   4. extractPdfContent      — orchestration: chọn PDF_TEXT hay fallback OCR (8 test)
 *   5. normalizeText          — helper chuẩn hóa text để so sánh (3 test)
 */
// ---------------------------------------------------------------------------
// 1. hasMeaningfulText — gate quyết định có cần fallback OCR hay không
// ---------------------------------------------------------------------------
describe("hasMeaningfulText — Unit Tests", () => {
  // Chuỗi rỗng → không có gì để đưa cho AI
  it("should return false for empty string", () => {
    expect(PdfExtractorService.hasMeaningfulText("")).toBe(false);
  });

  // Chỉ gồm whitespace (space/newline/tab) → coi như không có text
  it("should return false for whitespace-only string", () => {
    expect(PdfExtractorService.hasMeaningfulText("   ")).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("\n\t  \n")).toBe(false);
  });

  // pdf-parse đánh dấu trang bằng "-- N of M --"; text chỉ toàn marker
  // đồng nghĩa trang trắng → không meaningful
  it("should return false for string containing only page markers", () => {
    expect(PdfExtractorService.hasMeaningfulText("-- 1 of 1 --")).toBe(false);
    expect(PdfExtractorService.hasMeaningfulText("--  1 of  5 --")).toBe(false);
    expect(
      PdfExtractorService.hasMeaningfulText("-- 1 of 1 --\n-- 2 of 2 --")
    ).toBe(false);
  });

  // Marker lẫn whitespace vẫn phải bị coi là rỗng
  it("should return false for string with only whitespace and markers", () => {
    expect(PdfExtractorService.hasMeaningfulText("  \n-- 1 of 1 --\n  ")).toBe(false);
  });

  // Text thật (có câu hỏi) → meaningful
  it("should return true for string with actual text content", () => {
    expect(PdfExtractorService.hasMeaningfulText("Cau 1: De thi")).toBe(true);
  });

  // Text thật xen kẽ marker → vẫn meaningful (marker không làm mất giá trị text)
  it("should return true for text mixed with page markers", () => {
    const text = "Cau 1: Noi dung\n-- 1 of 1 --\n";
    expect(PdfExtractorService.hasMeaningfulText(text)).toBe(true);
  });

  // Ngưỡng thấp nhất: chỉ cần ≥ 1 ký tự không phải whitespace
  it("should return true for single non-whitespace character", () => {
    expect(PdfExtractorService.hasMeaningfulText("a")).toBe(true);
    expect(PdfExtractorService.hasMeaningfulText("1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. extractPdfText — các dạng kết quả pdf-parse có thể trả về
//    (string | { text } | { pages } | rỗng)
// ---------------------------------------------------------------------------
describe("extractPdfText — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // pdf-parse trả về string thuần → hàm giữ nguyên, không biến đổi
  it("should return the string when pdf-parse returns a plain string", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("Raw string text");

    const result = await PdfExtractorService.extractPdfText(Buffer.from("fake"));
    expect(result).toBe("Raw string text");
  });

  // pdf-parse không sinh nội dung → chuỗi rỗng (tín hiệu cho tầng trên fallback OCR)
  it("should return empty string when pdf-parse produces nothing", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");

    const result = await PdfExtractorService.extractPdfText(Buffer.from("fake"));
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 3. extractPdfTextUsingOCR — cấu trúc text OCR & lan truyền lỗi
// ---------------------------------------------------------------------------
describe("extractPdfTextUsingOCR — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Kết quả OCR nhiều trang phải bọc trong marker "--- Trang N ---"
  // để truy vết được text từng trang
  it("should produce page markers around OCR text", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      "--- Trang 1 ---\nCau 1: Noi dung OCR\n\n--- Trang 2 ---\nCau 2: Noi dung OCR\n\n"
    );

    const result = await PdfExtractorService.extractPdfTextUsingOCR(Buffer.from("fake"));
    expect(result).toContain("--- Trang 1 ---");
    expect(result).toContain("Cau 1: Noi dung OCR");
    expect(result).toContain("--- Trang 2 ---");
  });

  // OCR không đọc ra ký tự nào → chuỗi rỗng (không ném lỗi)
  it("should return empty string for empty OCR result", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    const result = await PdfExtractorService.extractPdfTextUsingOCR(Buffer.from("fake"));
    expect(result).toBe("");
  });

  // Lỗi của engine OCR phải lan truyền lên trên, không được nuốt
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
// 4. extractPdfContent — orchestration: quyết định PDF_TEXT hay fallback OCR
// ---------------------------------------------------------------------------
describe("extractPdfContent — Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();//Khôi phục tất cả các mock/spy về trạng thái và implementation ban đầu.
  });

  // Text layer đủ nội dung → trả ngay, KHÔNG gọi OCR (tiết kiệm chi phí)
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

  // Text layer chỉ chứa marker pdf-parse (tương đương trang trắng) → fallback OCR
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

  // Text layer rỗng → fallback OCR
  it("should fall back to OCR when extracted text is empty", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    const ocrSpy = vi
      .spyOn(PdfExtractorService, "extractPdfTextUsingOCR")
      .mockResolvedValue("--- Trang 1 ---\nText");

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(ocrSpy).toHaveBeenCalledTimes(1);
    expect(result.extractionMethod).toBe("OCR");
  });

  // pdf-parse ném lỗi (PDF hỏng) → vẫn phải thử OCR trước khi bỏ cuộc
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

  // Cả 2 luồng đều không ra text thực (OCR chỉ trả marker) → throw
  it("should throw when text extraction succeeds but OCR returns only markers", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      "-- 1 of 1 --\n-- 2 of 2 --"
    );

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found");
  });

  // Cả 2 luồng rỗng → throw "No extractable text found"
  it("should throw when both text extraction and OCR return empty", async () => {
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue("");

    await expect(
      PdfExtractorService.extractPdfContent(Buffer.from("fake"))
    ).rejects.toThrow("No extractable text found");
  });

  // Cả 2 luồng ném lỗi → lỗi của bước cuối (OCR) được ném ra ngoài
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

  // Text có nội dung thật dù lẫn marker → vẫn chọn PDF_TEXT, không OCR thừa
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
// 5. normalizeText — helper chuẩn hóa text dùng cho mọi assertion chứa nội dung
// ---------------------------------------------------------------------------
describe("normalizeText — Unit Tests", () => {
  // Gộp nhiều whitespace thành 1 space + lowercase → so sánh ổn định
  it("should normalize whitespace and lowercase text", () => {
    expect(normalizeText("  Cau 1:  ABC  ")).toBe("cau 1: abc");
  });

  // Chuỗi rỗng → vẫn rỗng, không lỗi
  it("should handle empty string", () => {
    expect(normalizeText("")).toBe("");
  });

  // Nhiều dòng → gộp thành 1 dòng (mất ký tự xuống dòng)
  it("should handle multiple lines", () => {
    const result = normalizeText("Cau 1\nA. Option A\nB. Option B");
    expect(result).toBe("cau 1 a. option a b. option b");
  });
});
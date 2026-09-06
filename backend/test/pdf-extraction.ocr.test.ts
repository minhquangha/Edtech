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

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

// All describes share mock isolation so spies never leak between tests.
beforeEach(() => {
  vi.restoreAllMocks();
});

/**
 * Các case OCR cơ bản (đề scan thực tế, scanned.pdf, OCR lỗi → throw)
 * đã được覆盖 trong pdf-extraction.test.ts (TC02, TC04, TC07).
 * File này chỉ chứa các case OCR chưa được cover ở nơi khác.
 */
describe("OCR Tests — các trường hợp bổ sung", () => {
  it("should return OCR page markers when the scanned image is blank", async () => {
    // scanned-empty-page.pdf chứa ảnh trắng 2×2: OCR không ra text nào,
    // pipeline vẫn trả về wrapper page marker của OCR.
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("scanned-empty-page.pdf")
    );
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("--- Trang 1 ---");
  }, 60_000);

  it("should preserve multi-page Vietnamese OCR content through the pipeline", async () => {
    // Nội dung OCR nhiều trang tiếng Việt phải được giữ nguyên qua pipeline
    // (không bị cắt, mất trang, hoặc làm hỏng dấu).
    vi.spyOn(PdfExtractorService, "extractPdfText").mockResolvedValue("");
    const ocrResult =
      "--- Trang 1 ---\nĐề kiểm tra vật lý 11\nCâu 1: Con lắc lò xo\nA. Đúng\nB. Sai\n\n" +
      "--- Trang 2 ---\nCâu 2: Dao động điều hòa\nA. Phương án A\nB. Phương án B";
    vi.spyOn(PdfExtractorService, "extractPdfTextUsingOCR").mockResolvedValue(
      ocrResult
    );

    const result = await PdfExtractorService.extractPdfContent(Buffer.from("fake"));

    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(normalizeText(result.rawText)).toContain("đề kiểm tra vật lý 11");
    expect(normalizeText(result.rawText)).toContain("câu 2: dao động điều hòa");
    expect(result.rawText).toContain("--- Trang 2 ---");
  });
});
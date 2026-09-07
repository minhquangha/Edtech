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
 * OCR TESTS — các trường hợp BỔ SUNG (không trùng pdf-extraction.test.ts).
 *
 * Các case OCR cơ bản đã được cover ở file pdf-extraction.test.ts:
 *   TC02 — scanned.pdf fallback OCR, TC04 — cả 2 luồng lỗi → throw,
 *   TC07 — đề scan thật test1.pdf chạy OCR thật.
 * File này chỉ chứa 2 case chưa có ở nơi khác:
 *
 *   1. scanned-empty-page.pdf — ảnh scan trắng tinh (OCR không ra chữ)
 *   2. Nội dung OCR nhiều trang tiếng Việt được giữ nguyên qua pipeline (mock)
 */
describe("OCR Tests — các trường hợp bổ sung", () => {
  /**
   * Ảnh scan trắng tinh: OCR đọc được 0 ký tự nhưng pipeline KHÔNG được crash.
   * Đầu vào : scanned-empty-page.pdf (ảnh trắng 2×2, không có text layer).
   * Kỳ vọng : method = OCR; rawText vẫn còn wrapper marker "--- Trang 1 ---"
   *            do extractPdfTextUsingOCR sinh ra (marker giúp hasMeaningfulText
   *            phân biệt "OCR chạy nhưng trang trắng" với "OCR hỏng").
   * Timeout : 60s — chạy OCR thật (Tesseract).
   */
  it("should return OCR page markers when the scanned image is blank", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("scanned-empty-page.pdf")
    );
    expect(result.extractionMethod).toBe(extraction_method_t.OCR);
    expect(result.rawText).toContain("--- Trang 1 ---");
  }, 60_000);

  /**
   * Bảo toàn nội dung OCR nhiều trang: kiểm tra logic Ghép/Chuẩn hóa bằng mock
   * (nhanh, deterministic — không cần Tesseract thật).
   * Đầu vào : text layer mock rỗng + OCR mock trả 2 trang tiếng Việt có dấu.
   * Kỳ vọng : method = OCR; nội dung TRANG 1 và TRANG 2 đều còn nguyên
   *            (không cắt trang, không hỏng dấu tiếng Việt), marker
   *            "--- Trang 2 ---" vẫn hiện diện trong rawText gốc.
   */
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
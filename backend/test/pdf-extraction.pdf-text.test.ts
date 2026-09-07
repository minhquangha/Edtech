import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extraction_method_t } from "@prisma/client";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { normalizeText, normalizeQuestionText } from "./helpers/normalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

/**
 * PDF TEXT LAYER TESTS — các trường hợp BỔ SUNG (không trùng pdf-extraction.test.ts).
 *
 * Các case cơ bản (text-layer.pdf, đề Hàn Thuyên part 1/2, ký hiệu vật lý trên
 * đề thật) đã được cover ở file pdf-extraction.test.ts (TC01, TC05–TC08).
 * File này tập trung vào fixture TỔNG HỢP đa dạng và ĐỘ PHỦ số lượng:
 *
 *   1. multi-page.pdf     — PDF 3 trang, mỗi trang nội dung riêng
 *   2. math-formulas.pdf  — ký hiệu toán/lý tổng hợp (π, λ, δ, đơn vị đo)
 *   3. large-text.pdf     — PDF 60 câu hỏi (độ phủ số lượng)
 *   4. structure-exam.pdf — đề có cấu trúc phân mục + nhiều loại câu hỏi
 *   5. blank-page.pdf     — trang trắng → không meaningful
 *   6. normalizeQuestionText — helper fuzzy matching (xóa dấu + số)
 */
describe("PDF Text Layer Extraction — các trường hợp bổ sung", () => {
  /**
   * PDF nhiều trang: KHÔNG được mất trang nào.
   * Đầu vào : multi-page.pdf (3 trang: Vật lý / Toán / Hóa, mỗi trang 1 câu).
   * Kỳ vọng : method = PDF_TEXT; cả 3 câu của 3 trang đều xuất hiện trong
   *            rawText sau normalize.
   */
  it("should extract every page of a multi-page PDF", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("multi-page.pdf")
    );

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("cau 1: trang mot - vat ly");
    expect(normalized).toContain("cau 2: trang hai - toan hoc");
    expect(normalized).toContain("cau 3: trang ba - hoa hoc");
  });

  /**
   * Ký hiệu khoa học trên fixture TỔNG HỢP (bổ sung cho TC08 vốn test trên đề thật).
   * Đầu vào : math-formulas.pdf chứa π = 3.14159, λ = 600 nm, δ = 2 cm, n/m, Hz, rad.
   * Kỳ vọng : method = PDF_TEXT; toàn bộ hằng số + đơn vị còn nguyên vẹn.
   */
  it("should extract math/physics symbols and measurement units", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("math-formulas.pdf")
    );

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("pi = 3.14159");
    expect(normalized).toContain("lambda = 600 nm");
    expect(normalized).toContain("delta = 2 cm");
    expect(normalized).toContain("n/m");
    expect(normalized).toContain("hz");
    expect(normalized).toContain("rad");
  });

  /**
   * Độ phủ số lượng: đề 60 câu phải trích xuất đủ cả 60, không bỏ sót câu cuối.
   * Đầu vào : large-text.pdf (60 câu hỏi, mỗi câu 4 phương án).
   * Kỳ vọng : method = PDF_TEXT; có "cau 1:" lẫn "cau 60:"; đếm marker
   *            "cau N:" được ≥ 60 lần.
   */
  it("should extract all 60 questions from a large text PDF", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("large-text.pdf")
    );

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    expect(normalized).toContain("cau 1:");
    expect(normalized).toContain("cau 60:");
    expect(normalized).toContain("d. phuong an d cau 60");

    const questionCount = (normalized.match(/cau \d+:/g) || []).length;
    expect(questionCount).toBeGreaterThanOrEqual(60);
  });

  /**
   * Đề có cấu trúc (tiêu đề, phân phần, nhiều loại câu): mọi khối phải được giữ.
   * Đầu vào : structure-exam.pdf (tiêu đề + PHẦN III trắc nghiệm + câu tự luận).
   * Kỳ vọng : method = PDF_TEXT; rawText chứa tiêu đề, tiêu mục, câu hỏi lựa chọn
   *            kèm phương án, và câu hỏi tự luận (công thức chu kỳ).
   */
  it("should extract structured exam sections and question types", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("structure-exam.pdf")
    );

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    // Tiêu đề đề thi
    expect(normalized).toContain("de kiem tra hoc ky i - mon vat ly 11");
    // Tiêu mục trắc nghiệm + câu hỏi
    expect(normalized).toContain("phan iii. cau hoi lua chon");
    expect(normalized).toContain("don vi cua tan so la gi");
    // Phương án A, B
    expect(normalized).toContain("a. giay (s)");
    expect(normalized).toContain("b. hec (hz)");
    // Câu hỏi tự luận
    expect(normalized).toContain("cau 3: viet cong thuc tinh chu ky");
  });

  /**
   * Trang trắng: text layer rỗng → hasMeaningfulText phải là false.
   * Đầu vào : blank-page.pdf (chỉ có lệnh vẽ "BT ET", không chữ).
   * Kỳ vọng : hasMeaningfulText(raw) = false — tín hiệu đúng cho tầng trên
   *            quyết định fallback OCR.
   */
  it("should produce raw text that is not meaningful when page is blank", async () => {
    const raw = await PdfExtractorService.extractPdfText(readFixture("blank-page.pdf"));
    expect(PdfExtractorService.hasMeaningfulText(raw)).toBe(false);
  });
});

describe("Normalization of extracted question text", () => {
  /**
   * normalizeQuestionText — fuzzy matching giữa 2 phiên bản cùng câu hỏi.
   * Đầu vào : câu tiếng Việt có dấu + số lượng ("200g").
   * Kỳ vọng : output chỉ còn chữ cái ASCII không dấu, không chữ số, không dấu
   *            câu ("cu  con lc l xo c khi lng g") — dùng để so khớp đề AI
   *            sinh ra với đề gốc bỏ qua khác biệt dấu/khoảng trắng.
   */
  it("should strip punctuation and digits for fuzzy matching", () => {
    const source = "Câu 1: Con lắc lò xo có khối lượng 200g";
    const normalized = normalizeQuestionText(source);
    // \w without the unicode flag matches [A-Za-z0-9_] only, so Vietnamese
    // diacritics and punctuation are stripped; digits are removed too.
    expect(normalized).toBe("cu  con lc l xo c khi lng g");
    expect(normalized).not.toMatch(/\d/);
    expect(normalized).not.toContain(":");
  });
});
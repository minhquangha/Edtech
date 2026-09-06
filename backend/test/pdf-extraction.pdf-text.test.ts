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
 * Các case cơ bản (text-layer.pdf, đề Hàn Thuyên part 1/2) đã được cover
 * trong pdf-extraction.test.ts (TC01, TC05, TC06, TC08). File này chỉ chứa
 * các case text-layer chưa được cover ở nơi khác: fixture tổng hợp đa dạng
 * và độ phủ số lượng câu hỏi.
 */
describe("PDF Text Layer Extraction — các trường hợp bổ sung", () => {
  //kiểm tra trích xuất text từ PDF có nhiều trang.
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
  //kiểm tra trích xuất các ký hiệu toán học và đơn vị đo lường.
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
  //kiểm tra trích xuất tất cả 60 câu hỏi từ một PDF lớn.
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
  // kiểm tra trích xuất các phần câu hỏi và loại câu hỏi.
  it("should extract structured exam sections and question types", async () => {
    const result = await PdfExtractorService.extractPdfContent(
      readFixture("structure-exam.pdf")
    );

    expect(result.extractionMethod).toBe(extraction_method_t.PDF_TEXT);

    const normalized = normalizeText(result.rawText);
    // Title
    expect(normalized).toContain("de kiem tra hoc ky i - mon vat ly 11");
    // Multiple choice section
    expect(normalized).toContain("phan iii. cau hoi lua chon");
    expect(normalized).toContain("don vi cua tan so la gi");
    // Options
    expect(normalized).toContain("a. giay (s)");
    expect(normalized).toContain("b. hec (hz)");
    // Short answer question
    expect(normalized).toContain("cau 3: viet cong thuc tinh chu ky");
  });
  // kiểm tra raw text không có nghĩa khi trang trống.
  it("should produce raw text that is not meaningful when page is blank", async () => {
    // blank-page.pdf có text layer rỗng → ở mức raw text chỉ cần đảm bảo
    // không có nội dung câu hỏi nào được trích xuất.
    const raw = await PdfExtractorService.extractPdfText(readFixture("blank-page.pdf"));
    expect(PdfExtractorService.hasMeaningfulText(raw)).toBe(false);
  });
});

describe("Normalization of extracted question text", () => {
  //kiểm tra xóa dấu câu và số cho việc khớp tương đồng.
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
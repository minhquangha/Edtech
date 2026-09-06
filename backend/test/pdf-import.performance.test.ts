import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfExtractorService from "@/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

function readBytes(name: string): number {
  return readFixture(name).length;
}

function msBetween(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
}

/**
 * Performance tests. The thresholds are deliberately generous so they stay
 * stable on slow CI machines while still catching catastrophic regressions
 * (e.g. accidental synchronous OCR, unbounded loops, N+1 page parsing).
 * Real timings are logged for humans to inspect.
 */
describe("Performance Tests — text-layer PDF extraction", () => {
  it("should extract a real-world exam PDF within 5 seconds", async () => {
    const buffer = readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf");
    //lưu lại mốc thời gian bắt đầu vào biến start
    const start = process.hrtime();

    const result = await PdfExtractorService.extractPdfContent(buffer);
    //khoảng thời gian từ start đến thời điểm hiện tại.
    const elapsed = msBetween(start);

    console.log(
      `\n[perf] text-layer real exam (${(buffer.length / 1024).toFixed(1)} KB): ${elapsed.toFixed(1)}ms`
    );
    expect(result.rawText.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("should extract the 60-question large PDF within 5 seconds", async () => {
    const buffer = readFixture("large-text.pdf");
    const start = process.hrtime();

    const result = await PdfExtractorService.extractPdfContent(buffer);
    const elapsed = msBetween(start);

    console.log(
      `\n[perf] large text PDF (${(buffer.length / 1024).toFixed(1)} KB, ${result.rawText.length} chars): ${elapsed.toFixed(1)}ms`
    );
    expect(result.rawText.length).toBeGreaterThan(900);
    expect(elapsed).toBeLessThan(5_000);
  });

  it("should extract a 3-page PDF within 2 seconds", async () => {
    const buffer = readFixture("multi-page.pdf");
    const start = process.hrtime();

    const result = await PdfExtractorService.extractPdfContent(buffer);
    const elapsed = msBetween(start);

    console.log(
      `\n[perf] 3-page text PDF (${(buffer.length / 1024).toFixed(1)} KB): ${elapsed.toFixed(1)}ms`
    );
    expect(result.rawText).toContain("Cau 3");
    expect(elapsed).toBeLessThan(2_000);
  });
});

describe("Performance Tests — OCR fallback", () => {
  it(
    "should OCR a real-world scanned PDF within 120 seconds",
    async () => {
      const buffer = readFixture("test1.pdf");
      const start = process.hrtime();

      const result = await PdfExtractorService.extractPdfContent(buffer);
      const elapsed = msBetween(start);

      console.log(
        `\n[perf] OCR real scanned exam (${(buffer.length / 1024).toFixed(1)} KB): ${elapsed.toFixed(1)}ms`
      );
      expect(result.rawText.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(120_000);
    },
    180_000
  );

  it(
    "should detect a no-text-layer PDF and complete OCR fallback within 30 seconds",
    async () => {
      const buffer = readFixture("scanned.pdf");
      const start = process.hrtime();

      const result = await PdfExtractorService.extractPdfContent(buffer);
      const elapsed = msBetween(start);

      console.log(
        `\n[perf] OCR fallback detection (${(buffer.length / 1024).toFixed(1)} KB): ${elapsed.toFixed(1)}ms`
      );
      expect(result.rawText.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(30_000);
    },
    60_000
  );
});

describe("Performance Tests — full upload pipeline", () => {
  it("should extract and process 3 text PDFs sequentially within 15 seconds", async () => {
    const buffers = [
      readFixture("text-layer.pdf"),
      readFixture("structure-exam.pdf"),
      readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf"),
    ];
    const start = process.hrtime();

    const results = [];
    for (const buffer of buffers) {
      results.push(await PdfExtractorService.extractPdfContent(buffer));
    }
    const elapsed = msBetween(start);

    console.log(
      `\n[perf] 3-PDF sequential pipeline: ${elapsed.toFixed(1)}ms total, ${results
        .map((r) => r.rawText.length)
        .join("/")} chars`
    );
    expect(results).toHaveLength(3);
    expect(elapsed).toBeLessThan(15_000);
  });

  it("should keep raw text size proportional to source PDF size (no loss/duplication)", async () => {
    const small = readBytes("text-layer.pdf");
    const big = readBytes("large-text.pdf");

    const smallResult = await PdfExtractorService.extractPdfContent(
      readFixture("text-layer.pdf")
    );
    const bigResult = await PdfExtractorService.extractPdfContent(
      readFixture("large-text.pdf")
    );

    // The larger PDF must yield more extracted text
    expect(bigResult.rawText.length).toBeGreaterThan(
      smallResult.rawText.length * 5
    );
    expect(big).toBeGreaterThan(small);

    console.log(
      `\n[perf] text scaling: ${small} bytes → ${smallResult.rawText.length} chars; ` +
        `${big} bytes → ${bigResult.rawText.length} chars`
    );
  });
});
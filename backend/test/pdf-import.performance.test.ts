import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfExtractorService from "@/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * PERFORMANCE TESTS — đo thời gian trích xuất (bước đắt nhất của /pdf/import)
 * theo 3 nhóm SLA:
 *
 *   A. Text layer (3 test) : PDF số hóa phải gần như tức thời (< 2–5s)
 *   B. OCR fallback (2 test): PDF scan vẫn xử lý được (< 30–120s)
 *   C. Pipeline (2 test)    : nhiều file tuần tự + tính tỉ lệ raw text
 *
 * Phương pháp:
 *   - process.hrtime() đo chính xác nanosecond; in [perf] ... ms ra console
 *     để con người theo dõi xu hướng qua các lần chạy.
 *   - Ngưỡng (expect elapsed < N) đặt RỘNG hơn thực tế nhiều lần để không
 *     fail oan trên máy CI chậm, nhưng vẫn bắt hồi quy nghiêm trọng
 *     (OCR bị sync, vòng lặp vô hạn, parse N+1 từng trang).
 *   - Timeout Vitest: mặc định 60s (vitest.config.ts); test OCR khai báo
 *     riêng 180s/60s — rộng hơn ngưỡng assert.
 *
 * Kết quả tham chiếu (máy dev, Node 20, Windows):
 *   A1 255KB → ~0.7s | A2 60 câu → ~0.11s | A3 3 trang → ~8ms
 *   B1 scan 899KB → ~10s | B2 fallback → ~0.9s | C1 3 file → ~0.31s
 */
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

// ---------------------------------------------------------------------------
// Nhóm A — Trích xuất PDF có text layer (không OCR)
// ---------------------------------------------------------------------------
describe("Performance Tests — text-layer PDF extraction", () => {
  /**
   * A1 — Đề thi thật 255 KB: ngưỡng 5s (thực đo ~725ms, dùng ~15% budget).
   * Bảo đảm đề số hóa thông thường xử lý gần như tức thời.
   */
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

  /**
   * A2 — PDF 60 câu hỏi: ngưỡng 5s (thực đo ~109ms, dùng ~2% budget).
   * Đong cả khối lượng output (rawText > 900 ký tự) — tốc độ không được đánh
   * đổi bằng việc mất text.
   */
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

  /**
   * A3 — PDF 3 trang nhỏ: ngưỡng 2s (thực đo ~8ms, dùng < 1% budget).
   * Ngưỡng chặt nhất trong nhóm — phát hiện sớm mọi độ trễ bất thường.
   */
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

// ---------------------------------------------------------------------------
// Nhóm B — OCR fallback (CPU-bound, chậm hơn text layer ~14 lần)
// ---------------------------------------------------------------------------
describe("Performance Tests — OCR fallback", () => {
  /**
   * B1 — Đề scan thật 899 KB: ngưỡng assert 120s (thực đo ~10.2s, dùng ~8.5%).
   * Timeout Vitest 180s làm lưới an toàn thứ hai. Bảo đảm OCR scan thật
   * hoàn thành trong biên chấp nhận được cho 1 request upload.
   */
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

  /**
   * B2 — Phát hiện "không có text layer" và chạy xong fallback OCR: ngưỡng
   * assert 30s (thực đo ~0.9s trên scanned.pdf). Đo cả chi phí phát hiện
   * text layer rỗng + khởi tạo Tesseract lần đầu.
   */
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

// ---------------------------------------------------------------------------
// Nhóm C — Pipeline upload tổng thể
// ---------------------------------------------------------------------------
describe("Performance Tests — full upload pipeline", () => {
  /**
   * C1 — 3 file text layer xử lý TUẦN TỰ (đúng như controller làm): ngưỡng 15s
   * (thực đo ~311ms). Kiểm chứng không có overhead khởi tạo lại engine/file.
   */
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

  /**
   * C2 — Tính tỉ lệ: PDF lớn hơn phải cho nhiều raw text hơn (≥ 5×), không được
   * mất dữ liệu hay nhân bản. Log cặp (bytes → chars) để quan sát tỉ lệ nén.
   */
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
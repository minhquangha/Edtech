import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfExtractorService from "../../src/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "..", "fixtures");

const FIXTURES = [
  { id: "PERF-001", name: "text-layer.pdf", category: "Small PDF (Text Layer)", file: "text-layer.pdf" },
  { id: "PERF-002", name: "scanned.pdf", category: "Small PDF (Scanned Image/OCR)", file: "scanned.pdf" },
  { id: "PERF-003", name: "1. Hàn Thuyên - Bắc Ninh-1.pdf", category: "Medium PDF (Text Layer)", file: "1. Hàn Thuyên - Bắc Ninh-1.pdf" },
  { id: "PERF-004", name: "1. Hàn Thuyên - Bắc Ninh-2.pdf", category: "Medium PDF (Text Layer)", file: "1. Hàn Thuyên - Bắc Ninh-2.pdf" },
  { id: "PERF-005", name: "test1.pdf", category: "Large PDF (Scanned OCR)", file: "test1.pdf" },
];

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runBenchmark() {
  console.log("==================================================");
  console.log("⚡ BACKEND PDF EXTRACTION PERFORMANCE BENCHMARK");
  console.log("==================================================\n");

  const results = [];

  for (const item of FIXTURES) {
    const filePath = path.join(fixturesDir, item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fixture file not found: ${item.file}`);
      continue;
    }

    const pdfBuffer = fs.readFileSync(filePath);
    const sizeKB = (pdfBuffer.length / 1024).toFixed(2);
    const iterations = item.file === "test1.pdf" ? 2 : 5; // Fewer iterations for heavy OCR
    const timings = [];
    let methodUsed = "";
    let extractedLength = 0;

    console.log(`⏱️ Benchmarking [${item.id}] ${item.name} (${sizeKB} KB) - ${iterations} runs...`);

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await PdfExtractorService.extractPdfContent(pdfBuffer);
      const end = performance.now();
      timings.push(end - start);
      methodUsed = res.extractionMethod;
      extractedLength = res.rawText.length;
    }

    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);
    const p90 = calculatePercentile(timings, 90);
    const p95 = calculatePercentile(timings, 95);

    results.push({
      ID: item.id,
      Category: item.category,
      Method: methodUsed,
      "Size (KB)": sizeKB,
      "Text Len": extractedLength,
      "Avg (ms)": avg.toFixed(2),
      "Min (ms)": min.toFixed(2),
      "Max (ms)": max.toFixed(2),
      "P90 (ms)": p90.toFixed(2),
      "P95 (ms)": p95.toFixed(2),
    });
  }

  console.log("\n📊 BENCHMARK SUMMARY RESULTS:");
  console.table(results);
  console.log("\n✅ Benchmark execution complete.\n");
}

runBenchmark().catch((err) => {
  console.error("❌ Benchmark failed:", err);
  process.exit(1);
});

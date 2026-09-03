import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "..", "fixtures");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const VUS = parseInt(process.env.VUS || "5", 10);
const DURATION_SEC = parseInt(process.env.DURATION || "10", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "mock-token";
const TARGET_PATH = process.env.TARGET_PATH || "/pdf/import";

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runWorker(workerId, stopTime, pdfBuffer, timings, errors) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);

  while (Date.now() < stopTime) {
    const start = performance.now();
    try {
      const bodyHead = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="pdfs"; filename="text-layer.pdf"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`
      );
      const bodyTail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([bodyHead, pdfBuffer, bodyTail]);

      const res = await fetch(`${BASE_URL}${TARGET_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      const end = performance.now();
      const latency = end - start;

      if (res.ok) {
        timings.push(latency);
      } else {
        errors.push({ status: res.status, latency });
      }
    } catch (err) {
      const end = performance.now();
      errors.push({ status: "ERR", message: err.message, latency: end - start });
    }

    // Brief delay to stagger requests
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function startLoadTest() {
  console.log("==================================================");
  console.log("🚀 HTTP PIPELINE LOAD TEST RUNNER");
  console.log("==================================================");
  console.log(`Target URL : ${BASE_URL}${TARGET_PATH}`);
  console.log(`Concurrency: ${VUS} Virtual Users (VUs)`);
  console.log(`Duration   : ${DURATION_SEC} seconds`);
  console.log("==================================================\n");

  const pdfPath = path.join(fixturesDir, "text-layer.pdf");
  if (!fs.existsSync(pdfPath)) {
    console.error("❌ Test fixture text-layer.pdf not found");
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const stopTime = Date.now() + DURATION_SEC * 1000;
  const timings = [];
  const errors = [];

  console.log(`⏳ Running load test for ${DURATION_SEC}s...`);

  const workers = [];
  for (let i = 0; i < VUS; i++) {
    workers.push(runWorker(i + 1, stopTime, pdfBuffer, timings, errors));
  }

  await Promise.all(workers);

  const totalReqs = timings.length + errors.length;
  const errorRate = totalReqs > 0 ? ((errors.length / totalReqs) * 100).toFixed(2) : "0.00";
  const rps = (totalReqs / DURATION_SEC).toFixed(2);
  const avg = timings.length > 0 ? (timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(2) : 0;
  const min = timings.length > 0 ? Math.min(...timings).toFixed(2) : 0;
  const max = timings.length > 0 ? Math.max(...timings).toFixed(2) : 0;
  const p50 = calculatePercentile(timings, 50).toFixed(2);
  const p90 = calculatePercentile(timings, 90).toFixed(2);
  const p95 = calculatePercentile(timings, 95).toFixed(2);
  const p99 = calculatePercentile(timings, 99).toFixed(2);

  console.log("\n📊 LOAD TEST RESULTS:");
  console.table([
    {
      "Total Reqs": totalReqs,
      "Success": timings.length,
      "Errors": errors.length,
      "Error %": `${errorRate}%`,
      "Req/sec": rps,
      "Avg (ms)": avg,
      "Min (ms)": min,
      "Max (ms)": max,
      "P50 (ms)": p50,
      "P90 (ms)": p90,
      "P95 (ms)": p95,
      "P99 (ms)": p99,
    },
  ]);

  if (errors.length > 0) {
    console.log("⚠️ Sample Error Responses:");
    console.log(errors.slice(0, 3));
  }

  console.log("\n✅ HTTP load test complete.\n");
}

startLoadTest().catch((err) => {
  console.error("❌ HTTP Load test failed:", err);
});

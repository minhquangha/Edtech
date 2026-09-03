# Edtech Backend Performance Testing Suite

## 1. Scope

This performance testing suite evaluates the end-to-end processing performance and bottleneck characteristics of the **PDF → Extract → AI Generate Exam** pipeline.

### Tested Endpoints & Components
- **HTTP Endpoint**: `POST /pdf/import` (Multipart upload + Extraction + DB persistence + AI generation)
- **HTTP Endpoint**: `POST /ai/create` (Direct AI assignment generation)
- **Internal Service**: `PdfExtractorService.extractPdfContent` (pdf-parse text layer & Tesseract.js OCR fallback engine)

---

## 2. Architecture

```
[ HTTP Client / k6 ]
        │
        ▼
   POST /pdf/import
        │
 ┌──────┴───────────────────────────────────────────────────────┐
 │ 1. Authenticator Middleware (JWT Verification)               │
 │ 2. Multer Memory Storage (Validation: Max 5 files, 10MB limit)│
 └──────┬───────────────────────────────────────────────────────┘
        │
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ 3. PdfExtractorService                                       │
 │    ├── Attempt 1: Fast PDF Text Layer extraction (pdf-parse) │
 │    └── Fallback: Tesseract OCR Image extraction               │
 └──────┬───────────────────────────────────────────────────────┘
        │
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ 4. UploadExamRepository                                      │
 │    └── Persists raw extracted text & metadata into DB        │
 └──────┬───────────────────────────────────────────────────────┘
        │
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ 5. AiService (Google Gemini / OpenAI External API)           │
 │    └── Converts extracted text to formatted Assignment json  │
 └──────┬───────────────────────────────────────────────────────┘
        │
        ▼
[ Response 200 OK + Assignment Payload ]
```

---

## 3. Test Case Matrix

| ID | Test Name | Purpose | Target / Fixture | Method |
|---|---|---|---|---|
| **PERF-001** | Small PDF Baseline | Measure text-layer baseline speed | `test/fixtures/text-layer.pdf` (0.7 KB) | PDF_TEXT |
| **PERF-002** | Scanned PDF Baseline | Measure Tesseract OCR fallback speed | `test/fixtures/scanned.pdf` (0.7 KB) | OCR |
| **PERF-003** | Medium Exam PDF Part 1 | Real-world physics exam extraction speed | `test/fixtures/1. Hàn Thuyên - Bắc Ninh-1.pdf` (255 KB) | PDF_TEXT |
| **PERF-004** | Medium Exam PDF Part 2 | Real-world physics exam extraction speed | `test/fixtures/1. Hàn Thuyên - Bắc Ninh-2.pdf` (162 KB) | PDF_TEXT |
| **PERF-005** | Large Scanned PDF | Stress test heavy OCR image processing | `test/fixtures/test1.pdf` (898 KB) | OCR |
| **PERF-006** | 1 VU E2E Latency | Single request full pipeline latency | `POST /pdf/import` | E2E |
| **PERF-007** | Concurrency Load Test | Concurrency behavior under low/med load (1, 5, 10, 20 VUs) | `POST /pdf/import` | Load Test |

---

## 4. Performance Metrics Glossary

- **Average Latency (`avg`)**: Mean execution time in milliseconds.
- **Median Latency (`median / p50`)**: Midpoint of execution times (50% of requests are faster).
- **p90 / p95 / p99 Latency**: 90th, 95th, and 99th percentile response times.
- **Throughput (RPS)**: Completed Requests Per Second.
- **Error Rate (`http_req_failed`)**: Percentage of failed or timed-out requests.

---

## 5. Initial Performance Baseline (Empirical Benchmark Results)

*(Measured on local test environment)*

| ID | Fixture | Size (KB) | Extraction Method | Avg Latency (ms) | P90 Latency (ms) | P95 Latency (ms) |
|---|---|---|---|---|---|---|
| **PERF-001** | `text-layer.pdf` | 0.70 KB | `PDF_TEXT` | ~75 ms | ~372 ms | ~372 ms |
| **PERF-002** | `scanned.pdf` | 0.65 KB | `OCR` | ~261 ms | ~280 ms | ~280 ms |
| **PERF-003** | `1. Hàn Thuyên - Bắc Ninh-1.pdf` | 255.44 KB | `PDF_TEXT` | ~52 ms | ~72 ms | ~72 ms |
| **PERF-004** | `1. Hàn Thuyên - Bắc Ninh-2.pdf` | 162.65 KB | `PDF_TEXT` | ~38 ms | ~39 ms | ~39 ms |
| **PERF-005** | `test1.pdf` | 898.66 KB | `OCR` | ~3,580 ms | ~4,000 ms | ~4,000 ms |

---

## 6. How to Run

### Method A: Pure Node.js Benchmark & Load Tests (No k6 Binary Required)

#### 1. PDF Extraction Benchmark (Isolated Engine Baseline)
Runs PDF extraction performance benchmarks directly using workspace fixtures:
```bash
npm run test:perf
```

#### 2. HTTP Pipeline Load Test (Direct API Load Test)
Runs HTTP load test against running backend server (`http://localhost:3000/pdf/import`):
```bash
npm run test:load
```
You can customize VUs, Duration, Base URL via environment variables:
```bash
VUS=10 DURATION=20 BASE_URL=http://localhost:3000 npm run test:load
```

---

### Method B: HTTP Load Testing using k6 CLI

#### Installing k6 on Windows:
```powershell
winget install k6 --source winget
# OR using Chocolatey:
choco install k6
```

#### Running k6 Performance Scripts:

##### 1. PDF Extraction Benchmark
```bash
k6 run test/performance/pdf-extraction.perf.js
```

##### 2. AI Exam Generation Endpoint Benchmark
```bash
k6 run -e BASE_URL=http://localhost:3000 test/performance/generate-exam.perf.js
```

##### 3. End-to-End Pipeline Load Test (5 Concurrent VUs)
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e VUS=5 \
  -e DURATION=30s \
  -e AUTH_TOKEN="<JWT_TOKEN>" \
  test/performance/load-test.js
```

##### 4. Controlled Stress Test (1 → 5 → 10 → 20 VUs Ramping)
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e AUTH_TOKEN="<JWT_TOKEN>" \
  test/performance/stress-test.js
```

---

## 7. Limitations & Key Bottleneck Observations

1. **OCR Processing Bottleneck**:
   - `PDF_TEXT` extraction is fast (~38ms - 75ms).
   - `OCR` fallback (Tesseract.js) takes **~3.5 seconds per file** on multi-page/scanned PDFs (`test1.pdf`), as canvas frame rendering and character recognition are CPU-intensive.

2. **External AI API Constraints**:
   - The end-to-end pipeline connects to external AI providers (Google Gemini / OpenAI).
   - End-to-end load tests should maintain conservative VU concurrency (1 - 20 VUs max) to prevent hitting external API rate limits or quota caps.

3. **Database Network Latency**:
   - `UploadExamRepository.saveRawText` inserts extracted raw text into PostgreSQL. Under heavy concurrency, connection pool sizing (`pg` / `prisma`) must be configured to match worker count.

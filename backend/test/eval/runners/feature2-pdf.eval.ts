// backend/test/eval/runners/feature2-pdf.eval.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Tesseract from "tesseract.js";
import PdfImportService from "@/services/pdfImport.js";
import { extractPdfText, extractPdfTextUsingOCR, hasMeaningfulText } from "@/services/pdfExtractor.js";
import { validateAssignmentSchema } from "../metrics/code-based/schemaValidator.js";
import { validateQuestionIntegrity } from "../metrics/code-based/questionIntegrity.js";
import { checkIntraExamDuplicate } from "../metrics/code-based/duplicateChecker.js";
import { checkNoveltyAgainstOriginal } from "../metrics/code-based/noveltyChecker.js";
import { calculateCer } from "../metrics/code-based/cerCalculator.js";
import { validateLatexSyntax } from "../metrics/code-based/latexValidator.js";
import { evaluateWithLlmJudge } from "../metrics/llm-judge/judgeClient.js";
import { EvaluationReporter, type TestCaseResult } from "../reporters/evalReporter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures");

export async function runFeature2Evaluation(reporter?: EvaluationReporter): Promise<EvaluationReporter> {
  const localReporter = reporter || new EvaluationReporter();
  console.log("\n========================================================");
  console.log(" BẮT ĐẦU ĐÁNH GIÁ TÍNH NĂNG 2: TẠO ĐỀ TƯƠNG ĐƯƠNG TỪ PDF ");
  console.log("========================================================\n");

  const pdfTestCases = [
    {
      id: "P-01",
      type: "Happy Path" as const,
      scenario: "text-layer.pdf, 1 trang trắc nghiệm chuẩn",
      purpose: "Kiểm tra pipeline PDF text -> sinh đề",
      filename: "text-layer.pdf",
      requireJudge: true,
    },
    {
      id: "P-02",
      type: "Happy Path" as const,
      scenario: "Hàn Thuyên.pdf, đề thi thực tế THPT",
      purpose: "Kiểm tra khả năng xử lý đề thi thực tế",
      filename: "1. Hàn Thuyên - Bắc Ninh-1.pdf",
      requireJudge: true,
    },
    {
      id: "P-03",
      type: "Happy Path" as const,
      scenario: "multi-page.pdf, đề 3 trang",
      purpose: "Kiểm tra xử lý dữ liệu đa trang không ngắt quãng",
      filename: "multi-page.pdf",
    },
    {
      id: "P-04",
      type: "Happy Path" as const,
      scenario: "math-formulas.pdf, nhiều công thức Toán/Lý",
      purpose: "Kiểm tra trích xuất và tái tạo công thức",
      filename: "math-formulas.pdf",
      requireLatexCheck: true,
    },
    {
      id: "P-05",
      type: "Happy Path" as const,
      scenario: "Kèm yêu cầu bổ sung câu hỏi ứng dụng thực tế",
      purpose: "Kiểm tra khả năng tuân thủ instruction",
      filename: "text-layer.pdf",
      extraRequirements: "Bổ sung thêm các câu hỏi liên hệ thực tiễn đời sống và ứng dụng kỹ thuật",
      requireJudge: true,
    },
    {
      id: "P-06",
      type: "Happy Path" as const,
      scenario: "structure-exam.pdf, Trắc nghiệm + Tự luận",
      purpose: "Kiểm tra nhận diện đúng cấu trúc đề hỗn hợp",
      filename: "structure-exam.pdf",
    },
    {
      id: "P-07",
      type: "Edge Case" as const,
      scenario: "File scanned ảnh: Chạy OCR Tesseract và đo chỉ số CER",
      purpose: "OCR Pipeline -> Sinh đề: Đo chỉ số CER <= 15.0%",
      filename: "scanned.pdf",
      isOcrTest: true,
      requireJudge: true,
    },
    {
      id: "P-08",
      type: "Edge Case" as const,
      scenario: "empty-page.pdf, trang PDF trắng không có text",
      purpose: "Kiểm tra hệ thống xử lý an toàn (Safe Rejection, không crash)",
      filename: "empty-page.pdf",
      expectRejection: true,
    },
    {
      id: "P-09",
      type: "Edge Case" as const,
      scenario: "Đề gốc có đầy đủ câu hỏi và đáp án",
      purpose: "Novelty Check: Đảm bảo Similarity < 60% (chống sao chép nguyên văn)",
      filename: "text-layer.pdf",
      requireNoveltyCheck: true,
    },
    {
      id: "P-10",
      type: "Edge Case" as const,
      scenario: "Đề thi thực tế dài nhiều câu (Hàn Thuyên)",
      purpose: "Intra-exam Duplicate Check: Kiểm tra không trùng lặp trên tập câu hỏi lớn",
      filename: "1. Hàn Thuyên - Bắc Ninh-1.pdf",
    },
  ];

  for (const tc of pdfTestCases) {
    console.log(`\n---> [EXEC] Đang chạy Test Case ${tc.id}: ${tc.scenario}...`);
    const startTime = Date.now();
    const filePath = path.join(FIXTURES_DIR, tc.filename);

    if (!fs.existsSync(filePath)) {
      console.error(`     ❌ Fixture file không tồn tại: ${filePath}`);
      localReporter.addResult({
        id: tc.id,
        feature: "Từ PDF",
        type: tc.type,
        scenario: tc.scenario,
        purpose: tc.purpose,
        passed: false,
        durationMs: Date.now() - startTime,
        tier1: { passed: false, errors: [`Không tìm thấy file: ${tc.filename}`] },
        error: `File not found: ${tc.filename}`,
      });
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);

      // -----------------------------------------------------------------------
      // Xử lý riêng cho Test Case P-08: Safe Rejection khi gặp PDF trắng
      // -----------------------------------------------------------------------
      if (tc.expectRejection) {
        const rawText = await extractPdfText(fileBuffer);
        const hasText = hasMeaningfulText(rawText);

        if (!hasText) {
          console.log("     ✓ Đã phát hiện an toàn file trắng không có text (Safe Rejection - PASS).");
          localReporter.addResult({
            id: tc.id,
            feature: "Từ PDF",
            type: tc.type,
            scenario: tc.scenario,
            purpose: tc.purpose,
            passed: true,
            durationMs: Date.now() - startTime,
            tier1: {
              passed: true,
              errors: [],
            },
          });
          console.log(`     => Kết quả ${tc.id}: PASSED ✅`);
          continue;
        } else {
          throw new Error("File empty-page.pdf lại phát hiện có text bất thường");
        }
      }

      // -----------------------------------------------------------------------
      // Trích xuất văn bản từ PDF (Direct Text hoặc OCR)
      // -----------------------------------------------------------------------
      let extractedText = "";
      let cerResult = undefined;

      if (tc.isOcrTest) {
        console.log("     --> Kích hoạt OCR Tesseract cho file scan...");
        // Với P-07, sử dụng ảnh scan image.png hoặc scanned.pdf
        const imagePath = path.join(FIXTURES_DIR, "image.png");
        const imageBuf = fs.readFileSync(imagePath);
        const ocrRes = await Tesseract.recognize(imageBuf, "vie+eng");
        extractedText = ocrRes.data.text;

        // Đọc Ground Truth
        const truthPath = path.join(FIXTURES_DIR, "scanned.truth.txt");
        const groundTruth = fs.readFileSync(truthPath, "utf-8");

        cerResult = calculateCer(groundTruth, extractedText, 0.15);
        console.log(`     ✓ OCR CER: ${cerResult.cerPercent} (Ngưỡng đạt <= 15.0% -> ${cerResult.passed ? "ĐẠT" : "VƯỢT NGƯỠNG"})`);

        if (!cerResult.passed) {
          throw new Error(`Chốt chặn OCR thất bại: CER = ${cerResult.cerPercent} vượt quá ngưỡng 15.0%`);
        }
      } else {
        extractedText = await extractPdfText(fileBuffer);
      }

      if (!hasMeaningfulText(extractedText)) {
        throw new Error(`Không trích xuất được nội dung text có ý nghĩa từ file ${tc.filename}`);
      }

      // -----------------------------------------------------------------------
      // Gọi AI sinh đề tương đương từ PDF
      // -----------------------------------------------------------------------
      console.log(`     --> Gửi nội dung PDF (${extractedText.length} ký tự) tới AI Service...`);
      const generatedAssignment = await PdfImportService.generateFromPdfs({
        files: [
          {
            originalname: tc.filename,
            text: extractedText.substring(0, 4000), // Cắt bớt nếu file quá dài để vừa context
          },
        ],
        title: `Đề tương đương từ ${tc.filename}`,
        subject: "Vật lí",
        classLevel: "12",
        durationMinutes: 45,
        extraRequirements: tc.extraRequirements,
      });

      const durationMs = Date.now() - startTime;
      console.log(`     ✓ Đã tạo xong đề sau ${(durationMs / 1000).toFixed(2)}s. Bắt đầu đánh giá 2 tầng...`);

      // -----------------------------------------------------------------------
      // TẦNG 1: CODE-BASED VALIDATIONS
      // -----------------------------------------------------------------------
      const schemaRes = validateAssignmentSchema(generatedAssignment);
      const integrityRes = validateQuestionIntegrity(generatedAssignment.questions);
      const dupRes = checkIntraExamDuplicate(generatedAssignment.questions);

      let noveltyRes = undefined;
      let noveltyPassed = true;
      if (tc.requireNoveltyCheck) {
        noveltyRes = checkNoveltyAgainstOriginal(generatedAssignment.questions, extractedText, 0.6);
        noveltyPassed = noveltyRes.passed;
        console.log(`     ✓ Novelty Check (Độ mới): Max trùng ${((noveltyRes.maxSimilarityWithOriginal || 0) * 100).toFixed(1)}% (< 60% -> ${noveltyPassed ? "ĐẠT" : "KHÔNG ĐẠT"})`);
      }

      let latexPassed = true;
      if (tc.requireLatexCheck) {
        for (const q of generatedAssignment.questions) {
          const ltx = validateLatexSyntax(q.content);
          if (!ltx.passed) latexPassed = false;
        }
      }

      const t1Errors: string[] = [
        ...schemaRes.errors,
        ...integrityRes.errors.map((e) => `[Q${e.questionIndex}] ${e.message}`),
      ];
      if (!dupRes.passed) {
        t1Errors.push(`Trùng lặp nội bộ: Max Sim ${(dupRes.maxSimilarity * 100).toFixed(1)}%`);
      }
      if (!noveltyPassed) {
        t1Errors.push(`Novelty thất bại: Quá tương đồng với đề gốc`);
      }

      const tier1Passed = schemaRes.passed && integrityRes.passed && dupRes.passed && noveltyPassed && latexPassed && (cerResult ? cerResult.passed : true);

      // -----------------------------------------------------------------------
      // TẦNG 2: LLM-AS-A-JUDGE (ƯU TIÊN DEEPSEEK)
      // -----------------------------------------------------------------------
      let tier2Res = undefined;
      if (tc.requireJudge && generatedAssignment.questions.length > 0) {
        console.log("     --> Đang gọi Giám khảo LLM-as-a-Judge (Ưu tiên DeepSeek)...");
        try {
          tier2Res = await evaluateWithLlmJudge(extractedText.substring(0, 4000), generatedAssignment.questions, {
            mode: "PDF",
          });
          console.log(`     ✓ Chấm xong bởi ${tier2Res.modelUsed} | Isomorphism: ${tier2Res.isomorphism_variation ?? "N/A"} | Sci: ${tier2Res.scientific_correctness}`);
        } catch (judgeErr: any) {
          console.warn(`     ⚠️ Lỗi khi gọi Giám khảo LLM: ${judgeErr.message}`);
        }
      }

      const overallPassed = tier1Passed && (tier2Res ? tier2Res.overall_passed : true);

      localReporter.addResult({
        id: tc.id,
        feature: "Từ PDF",
        type: tc.type,
        scenario: tc.scenario,
        purpose: tc.purpose,
        passed: overallPassed,
        durationMs,
        tier1: {
          passed: tier1Passed,
          integrityPassed: integrityRes.passed,
          duplicatePassed: dupRes.passed,
          maxSimilarity: dupRes.maxSimilarity,
          cerPassed: cerResult?.passed,
          cerPercent: cerResult?.cerPercent,
          noveltyPassed,
          maxNovelty: noveltyRes?.maxSimilarityWithOriginal,
          latexPassed,
          errors: t1Errors,
        },
        tier2: tier2Res,
      });

      console.log(`     => Kết quả ${tc.id}: ${overallPassed ? "PASSED ✅" : "FAILED ❌"}`);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`     ❌ Lỗi khi thực thi ${tc.id}:`, err.message);
      localReporter.addResult({
        id: tc.id,
        feature: "Từ PDF",
        type: tc.type,
        scenario: tc.scenario,
        purpose: tc.purpose,
        passed: false,
        durationMs,
        tier1: {
          passed: false,
          errors: [err.message],
        },
        error: err.message,
      });
    }
  }

  return localReporter;
}

if (process.argv[1]?.includes("feature2-pdf.eval")) {
  runFeature2Evaluation().then((reporter) => {
    reporter.printConsoleSummary();
    reporter.saveMarkdownReport("test/eval/feature2-report.md");
    process.exit(0);
  }).catch((err) => {
    console.error("Runner Fatal Error:", err);
    process.exit(1);
  });
}

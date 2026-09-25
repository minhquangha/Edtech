// backend/test/eval/runners/run-all.ts

import { EvaluationReporter } from "../reporters/evalReporter.js";
import { runFeature1Evaluation } from "./feature1-matrix.eval.js";
import { runFeature2Evaluation } from "./feature2-pdf.eval.js";

async function main() {
  console.log("\n********************************************************************************");
  console.log("*   HỆ THỐNG ĐÁNH GIÁ ĐỊNH LƯỢNG 2 TẦNG (20 TEST CASES - D-01..D-10, P-01..P-10)   *");
  console.log("********************************************************************************\n");

  const overallReporter = new EvaluationReporter();

  // 1. Chạy Tính năng 1 (D-01 đến D-10)
  await runFeature1Evaluation(overallReporter);

  // 2. Chạy Tính năng 2 (P-01 đến P-10)
  await runFeature2Evaluation(overallReporter);

  // 3. Kết xuất bảng kết quả tổng thể
  overallReporter.printConsoleSummary();

  // 4. Lưu báo cáo Markdown và JSON
  const mdReportPath = "test/eval/eval-report.md";
  const jsonReportPath = "test/eval/eval-report.json";

  overallReporter.saveMarkdownReport(mdReportPath);
  overallReporter.saveJsonReport(jsonReportPath);

  // Lưu bản sao tại thư mục gốc backend để dễ theo dõi
  overallReporter.saveMarkdownReport("eval-report.md");

  console.log("\n[HOÀN TẤT] Quá trình đánh giá định lượng 20 Test Cases đã hoàn thành xuất sắc!\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Lỗi chí mạng khi chạy Runner tổng hợp:", err);
  process.exit(1);
});

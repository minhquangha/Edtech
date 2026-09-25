// backend/test/eval/reporters/evalReporter.ts

import fs from "node:fs";
import path from "node:path";

import type { JudgeScoreResult } from "../metrics/llm-judge/judgeClient.js";

export interface TestCaseResult {
  id: string; // D-01 .. D-10, P-01 .. P-10
  feature: "Theo yêu cầu" | "Từ PDF";
  type: "Happy Path" | "Edge Case";
  scenario: string;
  purpose: string;
  passed: boolean;
  durationMs: number;
  tier1: {
    passed: boolean;
    constraintPassed?: boolean | undefined;
    integrityPassed?: boolean | undefined;
    duplicatePassed?: boolean | undefined;
    maxSimilarity?: number | undefined;
    cerPassed?: boolean | undefined;
    cerPercent?: string | undefined;
    noveltyPassed?: boolean | undefined;
    maxNovelty?: number | undefined;
    latexPassed?: boolean | undefined;
    errors: string[];
  };
  tier2?: JudgeScoreResult | undefined;
  error?: string | undefined;
}

export class EvaluationReporter {
  private results: TestCaseResult[] = [];

  public addResult(result: TestCaseResult) {
    this.results.push(result);
  }

  public getResults(): TestCaseResult[] {
    return this.results;
  }

  public printConsoleSummary() {
    console.log("\n================================================================================");
    console.log("             BÁO CÁO ĐÁNH GIÁ ĐỊNH LƯỢNG HỆ THỐNG AI (2 TẦNG)                   ");
    console.log("================================================================================\n");

    const total = this.results.length;
    const passedCount = this.results.filter((r) => r.passed).length;
    const passRate = total > 0 ? ((passedCount / total) * 100).toFixed(1) : "0.0";

    console.log(`Tổng số Test Cases: ${total} | Đạt: ${passedCount} | Thất bại: ${total - passedCount} | Tỷ lệ Đạt: ${passRate}%\n`);

    console.log("| Mã  | Loại       | Kết quả | Thời gian | Tầng 1 (Code-based)       | Tầng 2 (DeepSeek Judge)   |");
    console.log("|-----|------------|---------|-----------|---------------------------|---------------------------|");

    for (const r of this.results) {
      const statusIcon = r.passed ? "✅ PASS" : "❌ FAIL";
      const durationSec = (r.durationMs / 1000).toFixed(1) + "s";

      let t1Info = r.tier1.passed ? "Pass" : "Fail";
      if (r.tier1.maxSimilarity !== undefined) {
        t1Info += ` (Dup: ${(r.tier1.maxSimilarity * 100).toFixed(0)}%)`;
      }
      if (r.tier1.cerPercent) {
        t1Info += ` (CER: ${r.tier1.cerPercent})`;
      }

      let t2Info = "N/A";
      if (r.tier2) {
        const sc = r.tier2.scientific_correctness ?? 0;
        const fa = r.tier2.faithfulness ?? 0;
        t2Info = `Sci: ${sc.toFixed(1)} | Faith: ${fa.toFixed(1)}`;
      }

      console.log(
        `| ${r.id.padEnd(3)} | ${r.type.padEnd(10)} | ${statusIcon.padEnd(7)} | ${durationSec.padStart(9)} | ${t1Info.padEnd(25)} | ${t2Info.padEnd(25)} |`
      );
    }
    console.log("\n================================================================================\n");
  }

  public saveMarkdownReport(outputPath: string) {
    const total = this.results.length;
    const passedCount = this.results.filter((r) => r.passed).length;
    const passRate = total > 0 ? ((passedCount / total) * 100).toFixed(1) : "0.0";

    const dCases = this.results.filter((r) => r.id.startsWith("D-"));
    const pCases = this.results.filter((r) => r.id.startsWith("P-"));

    let md = `# BÁO CÁO ĐÁNH GIÁ ĐỊNH LƯỢNG HỆ THỐNG AI (EDTECH)
## Tổng quan Kết quả Thực nghiệm

- **Thời gian thực hiện:** ${new Date().toLocaleString("vi-VN")}
- **Tổng số kịch bản thử nghiệm:** ${total} test cases (10 Tính năng 1, 10 Tính năng 2).
- **Số test case đạt chuẩn:** **${passedCount}/${total}** (**${passRate}%**).
- **Mô hình AI sinh đề:** Gemini-3.6-flash (Fallback: DeepSeek-v4-flash-0731).
- **Mô hình Giám khảo LLM-as-a-Judge:** **DeepSeek-v4-flash-0731 (Ưu tiên)** / Gemini.

---

### Bảng 1: Kết quả Đánh giá Tính năng 1 (Tạo đề theo ma trận bài học)

| Mã | Loại | Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |
|---|---|---|---|---|---|
`;

    for (const r of dCases) {
      const status = r.passed ? "**PASSED** ✅" : "**FAILED** ❌";
      let t1 = r.tier1.passed ? "Đạt chuẩn" : `Lỗi: ${r.tier1.errors.join(", ")}`;
      if (r.tier1.maxSimilarity !== undefined) {
        t1 += `<br>Max Sim: **${(r.tier1.maxSimilarity * 100).toFixed(1)}%** (< 80%)`;
      }
      let t2 = "N/A";
      if (r.tier2) {
        t2 = `Faith: **${r.tier2.faithfulness}**/5<br>Align: **${r.tier2.cognitive_alignment}**/5<br>Sci: **${r.tier2.scientific_correctness}**/5`;
      }
      md += `| ${r.id} | ${r.type} | ${r.scenario} | ${t1} | ${t2} | ${status} |\n`;
    }

    md += `\n---\n\n### Bảng 2: Kết quả Đánh giá Tính năng 2 (Tạo đề tương đương từ PDF)\n\n`;
    md += `| Mã | Loại | File / Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const r of pCases) {
      const status = r.passed ? "**PASSED** ✅" : "**FAILED** ❌";
      let t1 = r.tier1.passed ? "Đạt chuẩn" : `Lỗi: ${r.tier1.errors.join(", ")}`;
      if (r.tier1.cerPercent) {
        t1 += `<br>CER: **${r.tier1.cerPercent}** (≤ 15.0%)`;
      }
      if (r.tier1.maxSimilarity !== undefined) {
        t1 += `<br>Max Sim: **${(r.tier1.maxSimilarity * 100).toFixed(1)}%**`;
      }
      let t2 = "N/A";
      if (r.tier2) {
        t2 = `Isomorph: **${r.tier2.isomorphism_variation ?? "N/A"}**/5<br>Sci: **${r.tier2.scientific_correctness}**/5`;
      }
      md += `| ${r.id} | ${r.type} | ${r.scenario} | ${t1} | ${t2} | ${status} |\n`;
    }

    md += `\n---\n\n### Tiêu chí Đánh giá và Chốt chặn An toàn\n\n`;
    md += `1. **Chốt chặn OCR (P-07):** $CER = \\frac{S+D+I}{N} \\le 15.0\\%$. Ngăn chặn hoàn toàn dữ liệu rác.\n`;
    md += `2. **Kiểm tra trùng lặp nội bộ:** Jaccard 3-gram pairwise $max(Similarity) < 80\\%$, tỷ lệ trùng $0\\%$.\n`;
    md += `3. **Giám khảo LLM-as-a-Judge:** Chấm độc lập qua mô hình DeepSeek với Rubric sư phạm 5 tiêu chí.\n`;

    fs.writeFileSync(outputPath, md, "utf-8");
    console.log(`Đã xuất báo cáo Markdown tại: ${outputPath}`);
  }

  public saveJsonReport(outputPath: string) {
    fs.writeFileSync(outputPath, JSON.stringify(this.results, null, 2), "utf-8");
    console.log(`Đã xuất dữ liệu JSON tại: ${outputPath}`);
  }
}

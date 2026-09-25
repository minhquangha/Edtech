// backend/test/eval/metrics/code-based/cerCalculator.ts

export interface CerEvaluationResult {
  passed: boolean;
  cer: number; // Tỷ lệ lỗi ký tự (0.0 đến 1.0+)
  cerPercent: string;
  referenceLength: number;
  hypothesisLength: number;
  editDistance: number;
  threshold: number;
}

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi ký tự
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = new Array(n + 1);
  let currRow = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const char1 = s1[i - 1];

    for (let j = 1; j <= n; j++) {
      const char2 = s2[j - 1];
      const cost = char1 === char2 ? 0 : 1;

      currRow[j] = Math.min(
        currRow[j - 1] + 1, // Insertion
        prevRow[j] + 1, // Deletion
        prevRow[j - 1] + cost // Substitution
      );
    }

    // Hoán đổi hàng
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

/**
 * Chuẩn hóa văn bản trước khi đo CER (loại bỏ khoảng trắng thừa)
 */
function cleanTextForCer(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

/**
 * Tính chỉ số Character Error Rate (CER):
 * CER = (S + D + I) / N = Levenshtein(ref, hyp) / length(ref)
 * Ngưỡng đạt chuẩn quy định trong plan.md: CER <= 15.0%
 */
export function calculateCer(
  reference: string,
  hypothesis: string,
  threshold = 0.15
): CerEvaluationResult {
  const cleanRef = cleanTextForCer(reference);
  const cleanHyp = cleanTextForCer(hypothesis);

  const refLen = cleanRef.length;
  if (refLen === 0) {
    const editDist = cleanHyp.length;
    return {
      passed: editDist === 0,
      cer: editDist === 0 ? 0 : 1.0,
      cerPercent: editDist === 0 ? "0.0%" : "100.0%",
      referenceLength: 0,
      hypothesisLength: cleanHyp.length,
      editDistance: editDist,
      threshold,
    };
  }

  const editDistance = levenshteinDistance(cleanRef, cleanHyp);
  const cer = editDistance / refLen;

  return {
    passed: cer <= threshold,
    cer,
    cerPercent: `${(cer * 100).toFixed(2)}%`,
    referenceLength: refLen,
    hypothesisLength: cleanHyp.length,
    editDistance,
    threshold,
  };
}

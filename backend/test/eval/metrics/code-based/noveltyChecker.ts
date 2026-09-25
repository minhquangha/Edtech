// backend/test/eval/metrics/code-based/noveltyChecker.ts

import { normalizeText, get3Grams } from "./duplicateChecker.js";

export interface NoveltyCheckResult {
  passed: boolean;
  maxSimilarityWithOriginal: number;
  highestMatchingQuestions: Array<{
    newQuestion: string;
    similarity: number;
  }>;
}

/**
 * Kiểm tra tính mới (Novelty) của câu hỏi sinh ra so với đề PDF gốc
 * Ngưỡng đạt: maxSimilarity < 0.6 (60%) để đảm bảo không sao chép nguyên văn
 */
export function checkNoveltyAgainstOriginal(
  newQuestions: Array<{ content: string }>,
  originalText: string,
  threshold = 0.6
): NoveltyCheckResult {
  let maxSimilarity = 0;
  const highMatches: Array<{ newQuestion: string; similarity: number }> = [];

  const originalWords = normalizeText(originalText).split(" ").filter(Boolean);
  const originalNgrams = get3Grams(originalWords);

  for (const q of newQuestions) {
    if (!q.content) continue;

    const qWords = normalizeText(q.content).split(" ").filter(Boolean);
    const qNgrams = get3Grams(qWords);

    let intersection = 0;
    for (const g of qNgrams) {
      if (originalNgrams.has(g)) {
        intersection++;
      }
    }

    const union = new Set([...qNgrams, ...originalNgrams]).size;
    // Jaccard similarity với toàn bộ văn bản hoặc containment similarity:
    // Độ tương đồng n-gram của câu hỏi nằm trong văn bản gốc:
    const containmentSim = qNgrams.size === 0 ? 0 : intersection / qNgrams.size;

    if (containmentSim > maxSimilarity) {
      maxSimilarity = containmentSim;
    }

    if (containmentSim >= threshold) {
      highMatches.push({
        newQuestion: q.content,
        similarity: containmentSim,
      });
    }
  }

  return {
    passed: highMatches.length === 0,
    maxSimilarityWithOriginal: maxSimilarity,
    highestMatchingQuestions: highMatches,
  };
}

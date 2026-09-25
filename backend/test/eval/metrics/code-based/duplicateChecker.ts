// backend/test/eval/metrics/code-based/duplicateChecker.ts

export interface DuplicatePair {
  q1: string;
  q2: string;
  similarity: number;
}

export interface DuplicateCheckResult {
  passed: boolean;
  maxSimilarity: number;
  duplicatePairs: DuplicatePair[];
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function get3Grams(words: string[]): Set<string> {
  const ngrams = new Set<string>();
  if (words.length < 3) {
    if (words.length > 0) {
      ngrams.add(words.join(" "));
    }
    return ngrams;
  }
  for (let i = 0; i <= words.length - 3; i++) {
    ngrams.add(words.slice(i, i + 3).join(" "));
  }
  return ngrams;
}

/**
 * Kiểm tra trùng lặp nội bộ giữa các câu hỏi trong cùng 1 đề thi
 * Ngưỡng đạt: maxSimilarity < 0.8 (80%), số cặp trùng = 0.
 */
export function checkIntraExamDuplicate(
  questions: Array<{ content: string }>,
  threshold = 0.8
): DuplicateCheckResult {
  let maxSimilarity = 0;
  const duplicatePairs: DuplicatePair[] = [];

  if (!questions || questions.length <= 1) {
    return {
      passed: true,
      maxSimilarity: 0,
      duplicatePairs: [],
    };
  }

  for (let i = 0; i < questions.length; i++) {
    const q1 = questions[i];
    if (!q1?.content) continue;

    for (let j = i + 1; j < questions.length; j++) {
      const q2 = questions[j];
      if (!q2?.content) continue;

      const w1 = normalizeText(q1.content).split(" ").filter(Boolean);
      const w2 = normalizeText(q2.content).split(" ").filter(Boolean);

      const g1 = get3Grams(w1);
      const g2 = get3Grams(w2);

      let intersection = 0;
      for (const g of g1) {
        if (g2.has(g)) intersection++;
      }

      const union = new Set([...g1, ...g2]).size;
      const sim = union === 0 ? 0 : intersection / union;

      if (sim > maxSimilarity) maxSimilarity = sim;
      if (sim >= threshold) {
        duplicatePairs.push({
          q1: q1.content,
          q2: q2.content,
          similarity: sim,
        });
      }
    }
  }

  return {
    passed: duplicatePairs.length === 0,
    maxSimilarity,
    duplicatePairs,
  };
}

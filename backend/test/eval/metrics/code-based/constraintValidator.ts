// backend/test/eval/metrics/code-based/constraintValidator.ts

import type { CognitiveLevel, QuestionType, QuestionRequest } from "@/types/assignments.js";
import type { AiRequest } from "@/types/ai-service.js";

export interface ConstraintCheckResult {
  passed: boolean;
  totalCountExpected: number;
  totalCountActual: number;
  levelCounts: Record<CognitiveLevel, { expected: number; actual: number }>;
  typeCounts: Record<QuestionType, { expected: number; actual: number }>;
  errors: string[];
}

/**
 * Kiểm tra tính tuân thủ ma trận đầu vào (Demand) vs đầu ra (Generated Questions)
 */
export function validateConstraints(
  demand: AiRequest,
  questions: QuestionRequest[]
): ConstraintCheckResult {
  const errors: string[] = [];
  const groups = demand.data.question_config.groups;

  // 1. Tính toán kỳ vọng từ demand
  let totalCountExpected = 0;
  const expectedLevels: Record<CognitiveLevel, number> = { NB: 0, TH: 0, VD: 0 };
  const expectedTypes: Record<QuestionType, number> = {
    SINGLE_CHOICE: 0,
    MULTIPLE_CHOICE: 0,
    TRUE_FALSE: 0,
    SHORT_ANSWER: 0,
  };

  for (const g of groups) {
    totalCountExpected += g.count;
    if (g.difficulty in expectedLevels) {
      expectedLevels[g.difficulty] = (expectedLevels[g.difficulty] || 0) + g.count;
    }
    if (g.type in expectedTypes) {
      expectedTypes[g.type] = (expectedTypes[g.type] || 0) + g.count;
    }
  }

  // 2. Thống kê thực tế từ questions
  const totalCountActual = questions?.length || 0;
  const actualLevels: Record<CognitiveLevel, number> = { NB: 0, TH: 0, VD: 0 };
  const actualTypes: Record<QuestionType, number> = {
    SINGLE_CHOICE: 0,
    MULTIPLE_CHOICE: 0,
    TRUE_FALSE: 0,
    SHORT_ANSWER: 0,
  };

  for (const q of questions || []) {
    if (q.cognitive_level && q.cognitive_level in actualLevels) {
      actualLevels[q.cognitive_level]++;
    }
    if (q.question_type && q.question_type in actualTypes) {
      actualTypes[q.question_type]++;
    }
  }

  // 3. So khớp tổng số câu hỏi
  if (totalCountActual !== totalCountExpected) {
    errors.push(
      `Tổng số câu hỏi không khớp: kỳ vọng ${totalCountExpected}, thực tế ${totalCountActual}`
    );
  }

  // 4. So khớp mức độ nhận thức
  const levelCounts: Record<CognitiveLevel, { expected: number; actual: number }> = {
    NB: { expected: expectedLevels.NB, actual: actualLevels.NB },
    TH: { expected: expectedLevels.TH, actual: actualLevels.TH },
    VD: { expected: expectedLevels.VD, actual: actualLevels.VD },
  };

  for (const level of ["NB", "TH", "VD"] as CognitiveLevel[]) {
    if (levelCounts[level].expected !== levelCounts[level].actual) {
      errors.push(
        `Phân bổ mức ${level} sai lệch: kỳ vọng ${levelCounts[level].expected}, thực tế ${levelCounts[level].actual}`
      );
    }
  }

  // 5. So khớp loại câu hỏi
  const typeCounts: Record<QuestionType, { expected: number; actual: number }> = {
    SINGLE_CHOICE: { expected: expectedTypes.SINGLE_CHOICE, actual: actualTypes.SINGLE_CHOICE },
    MULTIPLE_CHOICE: { expected: expectedTypes.MULTIPLE_CHOICE, actual: actualTypes.MULTIPLE_CHOICE },
    TRUE_FALSE: { expected: expectedTypes.TRUE_FALSE, actual: actualTypes.TRUE_FALSE },
    SHORT_ANSWER: { expected: expectedTypes.SHORT_ANSWER, actual: actualTypes.SHORT_ANSWER },
  };

  for (const type of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as QuestionType[]) {
    if (typeCounts[type].expected !== typeCounts[type].actual) {
      errors.push(
        `Phân loại ${type} sai lệch: kỳ vọng ${typeCounts[type].expected}, thực tế ${typeCounts[type].actual}`
      );
    }
  }

  return {
    passed: errors.length === 0,
    totalCountExpected,
    totalCountActual,
    levelCounts,
    typeCounts,
    errors,
  };
}

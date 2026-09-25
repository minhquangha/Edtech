// backend/test/eval/metrics/code-based/questionIntegrity.ts

import type { QuestionRequest } from "@/types/assignments.js";

export interface IntegrityCheckResult {
  passed: boolean;
  totalQuestions: number;
  validQuestions: number;
  errors: Array<{ questionIndex: number; message: string }>;
}

/**
 * Kiểm tra tính toàn vẹn cú pháp và định dạng của từng câu hỏi
 */
export function validateQuestionIntegrity(questions: QuestionRequest[]): IntegrityCheckResult {
  const errors: Array<{ questionIndex: number; message: string }> = [];

  if (!questions || questions.length === 0) {
    return {
      passed: false,
      totalQuestions: 0,
      validQuestions: 0,
      errors: [{ questionIndex: -1, message: "Danh sách câu hỏi rỗng" }],
    };
  }

  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // 1. Kiểm tra nội dung câu hỏi
    if (!q.content || q.content.trim().length === 0) {
      errors.push({ questionIndex: qNum, message: "Nội dung câu hỏi rỗng" });
    }

    // 2. Kiểm tra theo từng loại câu hỏi
    const qType = q.question_type || (q as any).type;
    switch (qType) {
      case "SINGLE_CHOICE": {
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          errors.push({
            questionIndex: qNum,
            message: `SINGLE_CHOICE yêu cầu ít nhất 2 phương án (hiện có: ${q.answers?.length || 0})`,
          });
        } else {
          const correctCount = q.answers.filter((a) => a.isCorrect === true).length;
          if (correctCount !== 1) {
            errors.push({
              questionIndex: qNum,
              message: `SINGLE_CHOICE phải có đúng 1 đáp án đúng (hiện có: ${correctCount})`,
            });
          }

          // Kiểm tra phương án rỗng
          for (const ans of q.answers) {
            if (!ans.content || ans.content.trim().length === 0) {
              errors.push({ questionIndex: qNum, message: "Tồn tại phương án có nội dung rỗng" });
              break;
            }
          }

          // Kiểm tra phương án trùng lặp
          const uniqueTexts = new Set(q.answers.map((a) => a.content.trim().toLowerCase()));
          if (uniqueTexts.size < q.answers.length) {
            errors.push({ questionIndex: qNum, message: "Tồn tại các phương án có nội dung trùng lặp" });
          }
        }
        break;
      }

      case "MULTIPLE_CHOICE": {
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          errors.push({
            questionIndex: qNum,
            message: `MULTIPLE_CHOICE yêu cầu ít nhất 2 phương án (hiện có: ${q.answers?.length || 0})`,
          });
        } else {
          const correctCount = q.answers.filter((a) => a.isCorrect === true).length;
          if (correctCount < 1) {
            errors.push({
              questionIndex: qNum,
              message: "MULTIPLE_CHOICE phải có ít nhất 1 đáp án đúng",
            });
          }
        }
        break;
      }

      case "TRUE_FALSE": {
        const hasValidAnswerField =
          q.answer?.toLowerCase() === "true" || q.answer?.toLowerCase() === "false";
        const hasValidAnswersArray =
          Array.isArray(q.answers) &&
          q.answers.length === 2 &&
          q.answers.some((a) => a.isCorrect === true);

        if (!hasValidAnswerField && !hasValidAnswersArray) {
          errors.push({
            questionIndex: qNum,
            message: "TRUE_FALSE yêu cầu trường answer là 'true'/'false' hoặc có 2 phương án Đúng/Sai",
          });
        }
        break;
      }

      case "SHORT_ANSWER": {
        if (!q.answer || q.answer.trim().length === 0) {
          errors.push({
            questionIndex: qNum,
            message: "SHORT_ANSWER yêu cầu trường answer chứa đáp án mẫu không rỗng",
          });
        }
        break;
      }

      default: {
        errors.push({
          questionIndex: qNum,
          message: `Loại câu hỏi không hợp lệ: ${(q as any).question_type}`,
        });
      }
    }
  });

  const validQuestions = questions.length - new Set(errors.map((e) => e.questionIndex)).size;

  return {
    passed: errors.length === 0,
    totalQuestions: questions.length,
    validQuestions,
    errors,
  };
}

// backend/test/eval/metrics/code-based/schemaValidator.ts

import { z } from "zod";

export const AnswerSchema = z.object({
  content: z.string().min(1, "Nội dung phương án không được rỗng"),
  isCorrect: z.boolean(),
});

export const QuestionSchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === "object") {
      return {
        ...data,
        question_type: data.question_type || data.type,
      };
    }
    return data;
  },
  z.object({
    content: z.string().min(1, "Nội dung câu hỏi không được rỗng"),
    question_type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]),
    cognitive_level: z.enum(["NB", "TH", "VD"]).optional(),
    answers: z.array(AnswerSchema),
    answer: z.string().optional(),
  })
);

export const AssignmentResponseSchema = z.object({
  title: z.string().min(1, "Tiêu đề đề thi không được rỗng"),
  description: z.string().optional(),
  class_level: z.union([z.string(), z.number()]),
  duration_minutes: z.number().int().positive("Thời lượng làm bài phải là số nguyên dương"),
  subject: z.string().min(1, "Tên môn học không được rỗng"),
  lessonIds: z.array(z.number()).optional(),
  questions: z.array(QuestionSchema).min(1, "Đề thi phải có ít nhất 1 câu hỏi"),
});

export interface SchemaValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Xác thực cấu trúc dữ liệu của Assignment thông qua Zod Schema
 */
export function validateAssignmentSchema(data: unknown): SchemaValidationResult {
  const result = AssignmentResponseSchema.safeParse(data);
  if (result.success) {
    return { passed: true, errors: [] };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return {
    passed: false,
    errors,
  };
}

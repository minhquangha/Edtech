import { z } from "zod";

export const cognitiveLevelEnum = z.enum(["NB", "TH", "VD"]);
export const questionTypeEnum = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
]);

// Helper for parsing numeric string or number to positive integer
const positiveIntCoerce = z
  .union([z.number(), z.string()])
  .transform((val, ctx) => {
    if (typeof val === "number") {
      if (!Number.isInteger(val) || val <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Must be a positive integer",
        });
        return z.NEVER;
      }
      return val;
    }
    const parsed = Number(val);
    if (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid positive integer",
      });
      return z.NEVER;
    }
    return parsed;
  });

// Group Config Schema
export const questionGroupConfigSchema = z.object({
  topic: z.string().optional(),
  count: z
    .number()
    .int("Count must be an integer")
    .positive("Count must be greater than 0"),
  difficulty: cognitiveLevelEnum,
  type: questionTypeEnum,
  lessonIds: z
    .array(
      z
        .number()
        .int("Lesson ID must be an integer")
        .positive("Lesson ID must be positive")
    )
    .min(1, "At least one lesson must be selected"),
});

// AI Create Schema: { data: LessonPayload }
export const aiCreateSchema = z.object({
  data: z.object({
    class_level: z.union([
      z.string().min(1, "Class level is required"),
      z.number().int().positive(),
    ]),
    subject: z.string().trim().min(1, "Subject is required"),
    topic: z.string().optional(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().optional(),
    time_duration: z
      .number()
      .int("Duration must be an integer")
      .positive("Duration must be greater than 0"),
    question_config: z.object({
      groups: z
        .array(questionGroupConfigSchema)
        .min(1, "At least one question group is required"),
    }),
  }),
});

// Answer Request Schema
export const answerRequestSchema = z.object({
  content: z.string(),
  isCorrect: z.boolean(),
});

// Question Request Schema
export const questionRequestSchema = z.object({
  content: z.string().trim().min(1, "Question content cannot be empty"),
  question_type: questionTypeEnum,
  cognitive_level: cognitiveLevelEnum.optional(),
  answer: z.string().optional(),
  answers: z.array(answerRequestSchema),
});

// Assignment Create Schema
export const createAssignmentSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string(),
  class_level: z.string().trim().min(1, "Class level is required"),
  duration_minutes: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be greater than 0"),
  subject: z.string().trim().min(1, "Subject is required"),
  lessonIds: z.array(z.number().int().positive()).optional(),
  questions: z
    .array(questionRequestSchema)
    .min(1, "At least one question is required"),
});

// Answer Update Schema
export const answerUpdateSchema = z.object({
  id: z.number().int().positive().optional(),
  content: z.string(),
  isCorrect: z.boolean(),
});

// Question Update Schema
export const questionUpdateSchema = z.object({
  id: z.number().int().positive().optional(),
  content: z.string().trim().min(1, "Question content cannot be empty"),
  question_type: questionTypeEnum,
  cognitive_level: cognitiveLevelEnum.optional(),
  answer: z.string().optional(),
  answers: z.array(answerUpdateSchema).optional(),
});

// Assignment Update Schema
export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  class_level: z.string().trim().min(1).optional(),
  duration_minutes: z.number().int().positive().optional(),
  subject: z.string().trim().min(1).optional(),
  lessonIds: z.array(z.number().int().positive()).optional(),
  questions: z.array(questionUpdateSchema).optional(),
});

// PDF Import Form Text Fields Schema (Multipart Text Fields)
export const pdfImportFormSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  subject: z.string().optional(),
  class_level: z.string().optional(),
  grade_id: positiveIntCoerce.optional(),
  duration_minutes: positiveIntCoerce.optional(),
  question_groups: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed);
      } catch {
        return false;
      }
    }, "question_groups must be a valid JSON array string"),
  extra_requirements: z.string().optional(),
});

// Auth Schemas
export const authSchema = z.object({
  data: z.object({
    username: z.string().trim().min(1, "Username is required"),
    password: z.string().trim().min(1, "Password is required"),
  }),
});

// ID Parameter Schema
export const idParamSchema = z.object({
  id: positiveIntCoerce,
});

// Lessons Query Schema
export const queryLessonsSchema = z.object({
  gradeId: positiveIntCoerce,
  subjectId: positiveIntCoerce,
});

// Subjects Query Schema
export const querySubjectsSchema = z.object({
  gradeId: positiveIntCoerce,
});

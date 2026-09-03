import type { CognitiveLevel, QuestionType } from "@/types/assignments.js";

export interface QuestionConfigPayload {
  groups: QuestionGroupConfig[];
}

export interface QuestionGroupConfig {
  topic?: string;
  count: number;
  difficulty: CognitiveLevel;
  type: QuestionType;
  lessonIds: number[];
}

export interface LessonPayload {
  class_level: string | number;
  subject: string;
  topic?: string;
  title: string;
  description?: string;
  time_duration: number;
  question_config: QuestionConfigPayload;
}

export interface AiRequest {
  data: LessonPayload;
}


export const assignmentAiSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    class_level: { type: "string" },
    duration_minutes: { type: "integer" },
    subject: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          content: { type: "string" },
          type: {
            type: "string",
            enum: ["MULTIPLE_CHOICE", "SINGLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"],
          },
          answer: { type: "string" },
          cognitive_level: {
            type: "string",
            enum: ["NB", "TH", "VD"],
          },
          answers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                content: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["content", "isCorrect"],
            },
          },
        },
        required: ["content", "type", "answers", "cognitive_level"],
      },
    },
  },
  required: ["title", "description", "class_level", "duration_minutes", "subject", "questions"],
};


export type UserRole = "STUDENT" | "TEACHER";

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterResponse {
  id: number;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  subject: string;
}

export interface Lesson {
  id: number;
  lesson_number: number;
  title: string;
}

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type CognitiveLevel = "NB" | "TH" | "VD";

// Question configuration for AI generation
export interface QuestionGroupConfig {
  id: string; // Internal React ID for keying UI
  count: number;
  lessonIds: number[];
  difficulty: CognitiveLevel;
  type: QuestionType;
}

export interface LessonPayload {
  class_level: string;
  subject: string;
  title: string;
  description?: string;
  time_duration: number;
  question_config: {
    groups: Array<{
      count: number;
      lessonIds: number[];
      difficulty: CognitiveLevel;
      type: QuestionType;
    }>;
  };
}

export interface AiRequest {
  data: LessonPayload;
}

export interface AnswerRequest {
  id?: number;
  content: string;
  isCorrect: boolean;
}

export interface QuestionRequest {
  id?: number;
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: AnswerRequest[];
  cognitive_level?: CognitiveLevel;
}

export interface AssignmentRequest {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  questions: QuestionRequest[];
}

export interface Answer {
  id: number;
  questionId: number;
  content: string;
  isCorrect: boolean;
}

export interface Question {
  id: number;
  assignmentId: number;
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: Answer[];
  cognitive_level?: CognitiveLevel;
}

export interface Assignment {
  id: number;
  title: string;
  description?: string;
  class_level: string;
  subject: string;
  duration_minutes: number;
  teacher_id: number;
  questions: Question[];
}

export interface AnswerUpdateRequest {
  id?: number;
  content: string;
  isCorrect: boolean;
}

export interface QuestionUpdateRequest {
  id?: number;
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: AnswerUpdateRequest[];
  cognitive_level?: CognitiveLevel;
}

export interface AssignmentUpdateRequest {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  questions: QuestionUpdateRequest[];
}

export interface EditableAnswer {
  id?: number;
  content: string;
  isCorrect: boolean;
}

export interface EditableQuestion {
  id?: number;
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: EditableAnswer[];
  cognitive_level?: CognitiveLevel;
}

export interface RawQuestionResponse {
  content?: string;
  type?: QuestionType;
  question_type?: QuestionType;
  cognitive_level?: CognitiveLevel;
  answer?: string | number | boolean;
  answers?: Array<{
    content?: string;
    isCorrect?: boolean | number | string;
  }>;
}


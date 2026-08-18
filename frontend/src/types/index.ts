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

// Question configuration for AI generation
export interface QuestionGroupConfig {
  id: string; // Internal React ID for keying UI
  count: number;
  lessonIds: number[];
  difficulty: "easy" | "medium" | "hard";
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
      difficulty: "easy" | "medium" | "hard";
      type: QuestionType;
    }>;
  };
}

export interface AiRequest {
  data: LessonPayload;
}

export interface AnswerRequest {
  content: string;
  isCorrect: boolean;
}

export interface QuestionRequest {
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: AnswerRequest[];
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
  id: number;
  content: string;
  isCorrect: boolean;
}

export interface QuestionUpdateRequest {
  id: number;
  content: string;
  question_type: QuestionType;
  answer?: string;
  answers?: AnswerUpdateRequest[];
}

export interface AssignmentUpdateRequest {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  questions: QuestionUpdateRequest[];
}

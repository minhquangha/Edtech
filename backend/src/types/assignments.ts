export interface Question {
  id: number;
  assignmentId: number;
  content: string;
  question_type: "MULTIPLE_CHOICE" | "SINGLE_CHOICE";
  points?: number;
  answers: Answer[];
}

export interface Answer {
  id: number;
  questionId: number;
  content: string;
  isCorrect: boolean;
}


export interface Assignment {
  id: number;
  title: string;
  description?: string;
  class_level:string;
  subject:string;
  duration_minutes: number;
  teacher_id:number;
  questions: Question[];
}


export interface AssignmentRequest {
  title: string;
  description: string;
  class_level:string;
  duration_minutes: number;
  subject:string;
  questions: QuestionRequest[];
}

export interface QuestionRequest {
  content: string;
  question_type: "MULTIPLE_CHOICE" | "SINGLE_CHOICE";
  answers: AnswerRequest[];
}

export interface AnswerRequest {
  content: string;
  isCorrect: boolean;
}


export interface AssignmentUpdateRequest {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  questions: QuestionUpdateRequest[];
}

export interface QuestionUpdateRequest {
  id: number;
  content: string;
  question_type: "MULTIPLE_CHOICE" | "SINGLE_CHOICE";
  answers: AnswerUpdateRequest[];
}

export interface AnswerUpdateRequest {
  id: number;
  content: string;
  isCorrect: boolean;
}


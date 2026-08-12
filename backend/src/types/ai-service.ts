export interface QuestionConfigPayload {
  question_counts: number;
  difficulty: 'easy' | 'medium' | 'hard' ;
  question_types: "MULTIPLE_CHOICE" | "SINGLE_CHOICE";
}

export interface LessonPayload {
  class_level: string | number;
  subject: string;
  topic: string; 
  title: string;
  description?: string;
  time_duration: number;
  question_config: QuestionConfigPayload;
}
export interface AiRequest{
    data: LessonPayload
}
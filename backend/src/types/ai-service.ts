export interface QuestionConfigPayload {
  groups: QuestionGroupConfig[];
}

export interface QuestionGroupConfig {
  topic:string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
  type: "MULTIPLE_CHOICE" | "SINGLE_CHOICE";
  lessonIds: number[];
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


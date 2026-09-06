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
//# sourceMappingURL=ai-service.d.ts.map
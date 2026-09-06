export type QuestionType = "MULTIPLE_CHOICE" | "SINGLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type CognitiveLevel = "NB" | "TH" | "VD";
export interface Question {
    id: number;
    assignmentId: number;
    content: string;
    question_type: QuestionType;
    points?: number;
    cognitive_level?: CognitiveLevel;
    answers: Answer[];
    answer?: string;
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
    class_level: string;
    subject: string;
    duration_minutes: number;
    teacher_id: number;
    questions: Question[];
}
export interface TeacherAssignmentSummary {
    id: number;
    title: string;
    description?: string;
    duration_minutes: number;
    teacher_id: number;
    subject?: string;
    class_level?: string | number;
    subject_id?: number;
    grade_id?: number;
}
export interface GradeItem {
    id: number;
    grade: number;
}
export interface SubjectItem {
    id: number;
    subject: string;
}
export interface LessonSummaryItem {
    id: number;
    lesson_number: number;
    title: string;
}
export interface LessonContentItem extends LessonSummaryItem {
    content: string;
}
export interface AssignmentRequest {
    title: string;
    description: string;
    class_level: string;
    duration_minutes: number;
    subject: string;
    lessonIds?: number[];
    questions: QuestionRequest[];
}
export interface QuestionRequest {
    content: string;
    question_type: QuestionType;
    answers: AnswerRequest[];
    answer?: string;
    cognitive_level?: CognitiveLevel;
}
export interface AnswerRequest {
    content: string;
    isCorrect: boolean;
}
export interface AssignmentUpdateRequest {
    title?: string;
    description?: string;
    class_level?: string;
    duration_minutes?: number;
    subject?: string;
    lessonIds?: number[];
    questions?: QuestionUpdateRequest[];
}
export interface QuestionUpdateRequest {
    id?: number;
    content: string;
    question_type: QuestionType;
    answers?: AnswerUpdateRequest[];
    answer?: string;
    cognitive_level?: CognitiveLevel;
}
export interface AnswerUpdateRequest {
    id?: number;
    content: string;
    isCorrect: boolean;
}
//# sourceMappingURL=assignments.d.ts.map
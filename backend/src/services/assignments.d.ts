import type { AssignmentRequest, Assignment, AssignmentUpdateRequest, TeacherAssignmentSummary, GradeItem, SubjectItem, LessonSummaryItem, LessonContentItem } from "@/types/assignments.js";
declare const AssignmentService: {
    create: (assignmentReq: AssignmentRequest, teacher_id: number) => Promise<Assignment>;
    getById: (assignmentId: number) => Promise<Assignment | null>;
    getByTeacherId: (userId: number) => Promise<TeacherAssignmentSummary[]>;
    updateAssignment: (assignmentId: number, teacherId: number, assignment: AssignmentUpdateRequest) => Promise<void>;
    deleteById: (assignmentId: number, teacherId: number) => Promise<void>;
    getGrades: () => Promise<GradeItem[]>;
    getSubject: (gradeId: number) => Promise<SubjectItem[]>;
    getLessons: (gradeId: number, subjectId: number) => Promise<LessonSummaryItem[]>;
    getLessonsContent: (lessonIds: number[]) => Promise<LessonContentItem[]>;
};
export default AssignmentService;
//# sourceMappingURL=assignments.d.ts.map
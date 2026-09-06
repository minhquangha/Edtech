import type { AssignmentRequest, AssignmentUpdateRequest } from "@/types/assignments.js";
export declare const AssignmentRepository: {
    createWithRelations: (assignmentReq: AssignmentRequest, teacherId: number) => Promise<{
        assignment: {
            id: number;
            created_at: Date;
            updated_at: Date;
            title: string;
            description: string | null;
            duration_minutes: number;
            status: import("@prisma/client").$Enums.assignment_status_t;
            teacher_id: number;
        };
        questions: ({
            options: {
                id: number;
                created_at: Date;
                updated_at: Date;
                content: string;
                question_id: number;
                is_correct: boolean;
            }[];
        } & {
            id: number;
            created_at: Date;
            updated_at: Date;
            content: string;
            question_type: import("@prisma/client").$Enums.question_type_t;
            resource: string | null;
            explanation: string | null;
            answer: string | null;
        })[];
    }>;
    findByIdWithDetails: (assignmentId: number) => Promise<({
        lessonAssignments: ({
            lesson: {
                grade: {
                    id: number;
                    grade: number;
                };
                subject: {
                    id: number;
                    subject: string;
                };
            } & {
                id: number;
                content: string;
                title: string;
                lesson_number: number;
                subject_id: number;
                grade_id: number;
            };
        } & {
            id: number;
            lesson_id: number;
            assignment_id: number;
        })[];
        assignmentQuestions: ({
            question: {
                options: {
                    id: number;
                    created_at: Date;
                    updated_at: Date;
                    content: string;
                    question_id: number;
                    is_correct: boolean;
                }[];
            } & {
                id: number;
                created_at: Date;
                updated_at: Date;
                content: string;
                question_type: import("@prisma/client").$Enums.question_type_t;
                resource: string | null;
                explanation: string | null;
                answer: string | null;
            };
        } & {
            id: number;
            created_at: Date;
            updated_at: Date;
            order_index: number | null;
            points: number | null;
            assignment_id: number;
            question_id: number;
        })[];
    } & {
        id: number;
        created_at: Date;
        updated_at: Date;
        title: string;
        description: string | null;
        duration_minutes: number;
        status: import("@prisma/client").$Enums.assignment_status_t;
        teacher_id: number;
    }) | null>;
    findByTeacherId: (teacherId: number) => Promise<({
        lessonAssignments: ({
            lesson: {
                grade: {
                    id: number;
                    grade: number;
                };
                subject: {
                    id: number;
                    subject: string;
                };
            } & {
                id: number;
                content: string;
                title: string;
                lesson_number: number;
                subject_id: number;
                grade_id: number;
            };
        } & {
            id: number;
            lesson_id: number;
            assignment_id: number;
        })[];
    } & {
        id: number;
        created_at: Date;
        updated_at: Date;
        title: string;
        description: string | null;
        duration_minutes: number;
        status: import("@prisma/client").$Enums.assignment_status_t;
        teacher_id: number;
    })[]>;
    updateWithRelations: (assignmentId: number, teacherId: number, assignment: AssignmentUpdateRequest) => Promise<void>;
    deleteWithRelations: (assignmentId: number, teacherId: number) => Promise<void>;
};
export default AssignmentRepository;
//# sourceMappingURL=assignment.repository.d.ts.map
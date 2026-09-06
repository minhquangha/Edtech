export declare const LessonRepository: {
    findManyByGradeAndSubject: (gradeId: number, subjectId: number) => Promise<{
        id: number;
        title: string;
        lesson_number: number;
    }[]>;
    findContentsByIds: (lessonIds: number[]) => Promise<{
        id: number;
        content: string;
        title: string;
        lesson_number: number;
    }[]>;
    findManyByIds: (lessonIds: number[]) => Promise<({
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
    })[]>;
};
export default LessonRepository;
//# sourceMappingURL=lesson.repository.d.ts.map
export declare const CurriculumRepository: {
    findAllGrades: () => Promise<{
        id: number;
        grade: number;
    }[]>;
    findSubjectsByGradeId: (gradeId: number) => Promise<{
        id: number;
        subject: string;
    }[]>;
};
export default CurriculumRepository;
//# sourceMappingURL=curriculum.repository.d.ts.map
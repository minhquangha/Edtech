import prisma from "@/config/prisma.js";
export const CurriculumRepository = {
    findAllGrades: async () => {
        return await prisma.grade.findMany({
            select: {
                id: true,
                grade: true,
            },
            orderBy: { grade: "asc" },
        });
    },
    findSubjectsByGradeId: async (gradeId) => {
        return await prisma.subject.findMany({
            where: {
                lessons: {
                    some: {
                        grade_id: gradeId,
                    },
                },
            },
            select: {
                id: true,
                subject: true,
            },
            orderBy: {
                subject: "asc",
            },
        });
    },
};
export default CurriculumRepository;
//# sourceMappingURL=curriculum.repository.js.map
import prisma from "@/config/prisma.js";
export const LessonRepository = {
    findManyByGradeAndSubject: async (gradeId, subjectId) => {
        return await prisma.lesson.findMany({
            where: {
                grade_id: gradeId,
                subject_id: subjectId,
            },
            select: {
                id: true,
                lesson_number: true,
                title: true,
            },
            orderBy: {
                lesson_number: "asc",
            },
        });
    },
    findContentsByIds: async (lessonIds) => {
        return await prisma.lesson.findMany({
            where: {
                id: {
                    in: lessonIds,
                },
            },
            select: {
                id: true,
                lesson_number: true,
                title: true,
                content: true,
            },
            orderBy: {
                lesson_number: "asc",
            },
        });
    },
    findManyByIds: async (lessonIds) => {
        return await prisma.lesson.findMany({
            where: {
                id: {
                    in: lessonIds,
                },
            },
            include: {
                subject: true,
                grade: true,
            },
        });
    },
};
export default LessonRepository;
//# sourceMappingURL=lesson.repository.js.map
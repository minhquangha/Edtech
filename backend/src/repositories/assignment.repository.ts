import type { Prisma } from "@prisma/client";
import prisma from "@/config/prisma.js";
import type {
  AssignmentRequest,
  AssignmentUpdateRequest,
} from "@/types/assignments.js";

export const AssignmentRepository = {
  createWithRelations: async (
    assignmentReq: AssignmentRequest,
    teacherId: number,
  ) => {
    return await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const createdAssignment = await tx.assignment.create({
          data: {
            title: assignmentReq.title,
            description: assignmentReq.description,
            duration_minutes: assignmentReq.duration_minutes,
            teacher_id: teacherId,
            lessonAssignments: {
              create: (assignmentReq.lessonIds || []).map(
                (lessonId: number) => ({
                  lesson_id: lessonId,
                }),
              ),
            },
          },
        });

        const assignmentId = createdAssignment.id;
        const questionsData = (assignmentReq.questions || []).map((q) => ({
          content: q.content,
          question_type: q.question_type,
          answer: q.answer || null,
        }));
        const createdQuestions = await tx.question.createManyAndReturn({
          data: questionsData,
        });
        const assignmentQuestionsData: {
          assignment_id: number;
          question_id: number;
        }[] = [];
        const optionsData: {
          question_id: number;
          content: string;
          is_correct: boolean;
        }[] = [];
        createdQuestions.forEach((createdQ, index) => {
          const rawQ = assignmentReq.questions![index];
          // Bảng liên kết Assignment - Question
          assignmentQuestionsData.push({
            assignment_id: assignmentId,
            question_id: createdQ.id,
          });
          // Mảng đáp án Options
          if(!rawQ){
            return;
          }
          if (
            [
              "SINGLE_CHOICE",
              "MULTIPLE_CHOICE",
              "TRUE_FALSE",
              "SHORT_ANSWER",
            ].includes(rawQ.question_type) &&
            rawQ.answers?.length
          ) {
            rawQ.answers.forEach((ans) => {
              optionsData.push({
                question_id: createdQ.id,
                content: ans.content,
                is_correct: ans.isCorrect,
              });
            });
          }
        });
        // QUERY 2: Bulk insert tất cả liên kết AssignmentQuestion (1 lệnh SQL)
        await tx.assignmentQuestion.createMany({
          data: assignmentQuestionsData,
        });
        // QUERY 3: Bulk insert tất cả Options (1 lệnh SQL, nếu có đáp án)
          let createdOptions: Awaited<ReturnType<typeof tx.questionOption.createManyAndReturn>> = [];
        if (optionsData.length > 0) {
          createdOptions = await tx.questionOption.createManyAndReturn({
            data: optionsData,
          });
        }
          const questionsWithOptions = createdQuestions.map((q) => ({
          ...q,
          options: createdOptions.filter((opt) => opt.question_id === q.id),
        }));
        return {
          assignment: createdAssignment,
          questions: questionsWithOptions,
        };
      },
      { maxWait: 10000, timeout: 60000 },
    );
  },

  findByIdWithDetails: async (assignmentId: number) => {
    return await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        lessonAssignments: {
          include: {
            lesson: {
              include: {
                subject: true,
                grade: true,
              },
            },
          },
        },
        assignmentQuestions: {
          include: {
            question: {
              include: {
                options: {
                  orderBy: { id: "asc" },
                },
              },
            },
          },
        },
      },
    });
  },

  findByTeacherId: async (teacherId: number) => {
    return await prisma.assignment.findMany({
      where: { teacher_id: teacherId },
      include: {
        lessonAssignments: {
          include: {
            lesson: {
              include: {
                subject: true,
                grade: true,
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    });
  },

  updateWithRelations: async (
    assignmentId: number,
    teacherId: number,
    assignment: AssignmentUpdateRequest,
  ) => {
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const existingAssignment = await tx.assignment.findFirst({
          where: {
            id: assignmentId,
            teacher_id: teacherId,
          },
        });

        if (!existingAssignment) {
          throw new Error("Assignment not found or you do not have permission");
        }

        const updateData: {
          title?: string;
          description?: string;
          duration_minutes?: number;
        } = {};

        if (assignment.title !== undefined) updateData.title = assignment.title;
        if (assignment.description !== undefined)
          updateData.description = assignment.description;
        if (assignment.duration_minutes !== undefined)
          updateData.duration_minutes = assignment.duration_minutes;

        if (Object.keys(updateData).length > 0) {
          await tx.assignment.update({
            where: { id: assignmentId },
            data: updateData,
          });
        }

        if (
          Array.isArray(assignment.lessonIds) &&
          assignment.lessonIds.length > 0
        ) {
          await tx.lessonAssignment.deleteMany({
            where: { assignment_id: assignmentId },
          });

          await tx.lessonAssignment.createMany({
            data: assignment.lessonIds.map((lessonId: number) => ({
              assignment_id: assignmentId,
              lesson_id: lessonId,
            })),
          });
        }

        if (Array.isArray(assignment.questions)) {
          const oldAssignmentsQuestions = await tx.assignmentQuestion.findMany({
            where: { assignment_id: assignmentId },
            select: { question_id: true },
          });

          const oldQuestionIds = oldAssignmentsQuestions.map(
            (row) => row.question_id,
          );
          const requestQuestionIds: number[] = [];
          for (const questionReq of assignment.questions) {
            let currentQuestionId: number;

            if (questionReq.id && oldQuestionIds.includes(questionReq.id)) {
              currentQuestionId = questionReq.id;
              requestQuestionIds.push(currentQuestionId);

              await tx.question.update({
                where: { id: currentQuestionId },
                data: {
                  content: questionReq.content,
                  question_type: questionReq.question_type,
                  answer: questionReq.answer || null,
                },
              });
            } else {
              const newQuestion = await tx.question.create({
                data: {
                  content: questionReq.content,
                  question_type: questionReq.question_type,
                  answer: questionReq.answer || null,
                  assignmentQuestions: {
                    create: {
                      assignment_id: assignmentId,
                    },
                  },
                },
              });
              currentQuestionId = newQuestion.id;
              requestQuestionIds.push(currentQuestionId);
            }

            if (Array.isArray(questionReq.answers)) {
              const oldOptions = await tx.questionOption.findMany({
                where: { question_id: currentQuestionId },
                select: { id: true },
              });

              const oldOptionIds = oldOptions.map((opt) => opt.id);
              const requestOptionIds: number[] = [];

              for (const optionReq of questionReq.answers) {
                if (optionReq.id && oldOptionIds.includes(optionReq.id)) {
                  requestOptionIds.push(optionReq.id);
                  await tx.questionOption.update({
                    where: { id: optionReq.id },
                    data: {
                      content: optionReq.content,
                      is_correct: optionReq.isCorrect,
                    },
                  });
                } else {
                  const newOpt = await tx.questionOption.create({
                    data: {
                      question_id: currentQuestionId,
                      content: optionReq.content,
                      is_correct: optionReq.isCorrect,
                    },
                  });
                  requestOptionIds.push(newOpt.id);
                }
              }

              const optionsToDelete = oldOptionIds.filter(
                (id) => !requestOptionIds.includes(id),
              );

              if (optionsToDelete.length > 0) {
                await tx.questionOption.deleteMany({
                  where: {
                    id: { in: optionsToDelete },
                    question_id: currentQuestionId,
                  },
                });
              }
            }
          }

          const questionsToDelete = oldQuestionIds.filter(
            (id) => !requestQuestionIds.includes(id),
          );

          for (const qId of questionsToDelete) {
            await tx.questionOption.deleteMany({
              where: { question_id: qId },
            });

            await tx.assignmentQuestion.deleteMany({
              where: {
                assignment_id: assignmentId,
                question_id: qId,
              },
            });

            const questionUsage = await tx.assignmentQuestion.findFirst({
              where: { question_id: qId },
            });

            if (!questionUsage) {
              await tx.question.delete({
                where: { id: qId },
              });
            }
          }
        }
      },
      { maxWait: 10000, timeout: 60000 },
    );
  },

  deleteWithRelations: async (assignmentId: number, teacherId: number) => {
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const existingAssignment = await tx.assignment.findFirst({
          where: {
            id: assignmentId,
            teacher_id: teacherId,
          },
        });

        if (!existingAssignment) {
          throw new Error("Assignment not found or you do not have permission");
        }

        const assignmentQuestions = await tx.assignmentQuestion.findMany({
          where: { assignment_id: assignmentId },
          select: { question_id: true },
        });

        const questionIds = assignmentQuestions.map((row) => row.question_id);

        await tx.assignmentQuestion.deleteMany({
          where: { assignment_id: assignmentId },
        });

        await tx.lessonAssignment.deleteMany({
          where: { assignment_id: assignmentId },
        });

        // Chỉ xóa những question và options mà KHÔNG còn bài tập nào khác tham chiếu
        if (questionIds.length > 0) {
          const remainingUsages = await tx.assignmentQuestion.findMany({
            where: { question_id: { in: questionIds } },
            select: { question_id: true },
          });

          const stillUsedIds = new Set(remainingUsages.map((u) => u.question_id));
          const orphanIds = questionIds.filter((id) => !stillUsedIds.has(id));

          if (orphanIds.length > 0) {
            await tx.questionOption.deleteMany({
              where: { question_id: { in: orphanIds } },
            });

            await tx.question.deleteMany({
              where: { id: { in: orphanIds } },
            });
          }
        }

        await tx.assignment.delete({
          where: { id: assignmentId },
        });
      },
      { maxWait: 10000, timeout: 60000 },
    );
  },
};

export default AssignmentRepository;

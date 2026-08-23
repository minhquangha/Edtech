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
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdAssignment = await tx.assignment.create({
        data: {
          title: assignmentReq.title,
          description: assignmentReq.description,
          duration_minutes: assignmentReq.duration_minutes,
          teacher_id: teacherId,
          lessonAssignments: {
            create: assignmentReq.lessonIds.map((lessonId: number) => ({
              lesson_id: lessonId,
            })),
          },
        },
      });

      const assignmentId = createdAssignment.id;
      const createdQuestions = [];

      for (const questionReq of assignmentReq.questions) {
        const createdQuestion = await tx.question.create({
          data: {
            content: questionReq.content,
            question_type: questionReq.question_type,
            answer: questionReq.answer || null,
            assignmentQuestions: {
              create: {
                assignment_id: assignmentId,
              },
            },
            options: {
              create:
                questionReq.question_type === "SINGLE_CHOICE" ||
                questionReq.question_type === "MULTIPLE_CHOICE" ||
                questionReq.question_type === "TRUE_FALSE" ||
                questionReq.question_type === "SHORT_ANSWER"
                  ? (questionReq.answers || []).map((ans) => ({
                      content: ans.content,
                      is_correct: ans.isCorrect,
                    }))
                  : [],
            },
          },
          include: {
            options: true,
          },
        });

        createdQuestions.push(createdQuestion);
      }

      return {
        assignment: createdAssignment,
        questions: createdQuestions,
      };
    });
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
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      if (assignment.description !== undefined) updateData.description = assignment.description;
      if (assignment.duration_minutes !== undefined) updateData.duration_minutes = assignment.duration_minutes;

      if (Object.keys(updateData).length > 0) {
        await tx.assignment.update({
          where: { id: assignmentId },
          data: updateData,
        });
      }

      if (Array.isArray(assignment.lessonIds) && assignment.lessonIds.length > 0) {
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

        const oldQuestionIds = oldAssignmentsQuestions.map((row) => row.question_id);
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
    });
  },

  deleteWithRelations: async (assignmentId: number, teacherId: number) => {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

      if (questionIds.length > 0) {
        await tx.questionOption.deleteMany({
          where: { question_id: { in: questionIds } },
        });

        await tx.question.deleteMany({
          where: { id: { in: questionIds } },
        });
      }

      await tx.assignment.delete({
        where: { id: assignmentId },
      });
    });
  },
};

export default AssignmentRepository;

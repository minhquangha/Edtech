import type { QuestionOption } from "@prisma/client";
import {
  AssignmentRepository,
  CurriculumRepository,
  LessonRepository,
} from "@/repositories/index.js";
import type {
  Answer,
  AssignmentRequest,
  Question,
  Assignment,
  AssignmentUpdateRequest,
  QuestionType,
  TeacherAssignmentSummary,
  GradeItem,
  SubjectItem,
  LessonSummaryItem,
  LessonContentItem,
} from "@/types/assignments.js";

const AssignmentService = {
  create: async (
    assignmentReq: AssignmentRequest,
    teacher_id: number,
  ): Promise<Assignment> => {
    const { assignment, questions: createdQuestions } =
      await AssignmentRepository.createWithRelations(assignmentReq, teacher_id);

    const questions: Question[] = createdQuestions.map((createdQuestion) => {
      const answers: Answer[] = createdQuestion.options.map((opt: QuestionOption) => ({
        id: opt.id,
        questionId: createdQuestion.id,
        content: opt.content,
        isCorrect: opt.is_correct,
      }));

      return {
        id: createdQuestion.id,
        assignmentId: assignment.id,
        content: createdQuestion.content,
        question_type: createdQuestion.question_type as QuestionType,
        answers: answers,
        ...(createdQuestion.answer ? { answer: createdQuestion.answer } : {}),
      };
    });

    return {
      id: assignment.id,
      title: assignmentReq.title,
      description: assignmentReq.description,
      class_level: assignmentReq.class_level,
      subject: assignmentReq.subject,
      duration_minutes: assignmentReq.duration_minutes,
      teacher_id: teacher_id,
      questions: questions,
    };
  },

  getById: async (assignmentId: number): Promise<Assignment | null> => {
    const assignmentData = await AssignmentRepository.findByIdWithDetails(assignmentId);

    if (!assignmentData) {
      return null;
    }

    const firstLesson = assignmentData.lessonAssignments[0]?.lesson;

    const assignment: Assignment = {
      id: assignmentData.id,
      title: assignmentData.title,
      ...(assignmentData.description ? { description: assignmentData.description } : {}),
      duration_minutes: assignmentData.duration_minutes,
      teacher_id: assignmentData.teacher_id,
      subject: firstLesson?.subject?.subject ?? "",
      class_level: String(firstLesson?.grade?.grade ?? ""),
      questions: assignmentData.assignmentQuestions.map((aq) => {
        const q: Question = {
          id: aq.question.id,
          assignmentId: assignmentData.id,
          content: aq.question.content,
          question_type: aq.question.question_type as QuestionType,
          answers: aq.question.options.map((opt: QuestionOption) => ({
            id: opt.id,
            questionId: opt.question_id,
            content: opt.content,
            isCorrect: opt.is_correct,
          })),
          ...(aq.question.answer ? { answer: aq.question.answer } : {}),
        };
        return q;
      }),
    };

    return assignment;
  },

  getByTeacherId: async (userId: number): Promise<TeacherAssignmentSummary[]> => {
    const assignments = await AssignmentRepository.findByTeacherId(userId);

    return assignments.map((a) => {
      const firstLesson = a.lessonAssignments[0]?.lesson;
      return {
        id: a.id,
        title: a.title,
        ...(a.description ? { description: a.description } : {}),
        duration_minutes: a.duration_minutes,
        teacher_id: a.teacher_id,
        ...(firstLesson?.subject?.subject ? { subject: firstLesson.subject.subject } : {}),
        ...(firstLesson?.grade?.grade !== undefined ? { class_level: firstLesson.grade.grade } : {}),
        ...(firstLesson?.subject?.id ? { subject_id: firstLesson.subject.id } : {}),
        ...(firstLesson?.grade?.id ? { grade_id: firstLesson.grade.id } : {}),
      };
    });
  },

  updateAssignment: async (
    assignmentId: number,
    teacherId: number,
    assignment: AssignmentUpdateRequest,
  ): Promise<void> => {
    await AssignmentRepository.updateWithRelations(assignmentId, teacherId, assignment);
  },

  deleteById: async (
    assignmentId: number,
    teacherId: number,
  ): Promise<void> => {
    await AssignmentRepository.deleteWithRelations(assignmentId, teacherId);
  },

  getGrades: async (): Promise<GradeItem[]> => {
    return await CurriculumRepository.findAllGrades();
  },

  getSubject: async (gradeId: number): Promise<SubjectItem[]> => {
    return await CurriculumRepository.findSubjectsByGradeId(gradeId);
  },

  getLessons: async (gradeId: number, subjectId: number): Promise<LessonSummaryItem[]> => {
    return await LessonRepository.findManyByGradeAndSubject(gradeId, subjectId);
  },

  getLessonsContent: async (lessonIds: number[]): Promise<LessonContentItem[]> => {
    return await LessonRepository.findContentsByIds(lessonIds);
  },
};

export default AssignmentService;

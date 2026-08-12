import pool from "@/config/db.js";
import {
  type Answer,
  type AssignmentRequest,
  type Question,
  type Assignment,
} from "@/types/assignments.js";

const AssignmentService = {
  create: async (assignmentReq: AssignmentRequest, teacher_id: number) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Tạo Assignment
      const assignmentQuery = `
        INSERT INTO "Assignment" (
          title,
          description,
          class_level,
          subject,
          duration_minutes,
          teacher_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      const assignmentResult = await client.query(assignmentQuery, [
        assignmentReq.title,
        assignmentReq.description,
        assignmentReq.class_level,
        assignmentReq.subject,
        assignmentReq.duration_minutes,
        teacher_id,
      ]);

      const assignmentId = assignmentResult.rows[0].id;
      const questions: Question[] = [];

      // 2. Tạo Question + AssignmentQuestion + Question_Options
      for (const question of assignmentReq.questions) {
        const questionQuery = `
          INSERT INTO "Question" (
            content,
            question_type
          )
          VALUES ($1, $2)
          RETURNING id;
        `;
        const questionResult = await client.query(questionQuery, [
          question.content,
          question.type,
        ]);
        const questionId = questionResult.rows[0].id;

        // 3. Tạo quan hệ Assignment - Question
        const assignQuestionQuery = `
          INSERT INTO "Assignment_Question" (
            assignment_id,
            question_id
          )
          VALUES ($1, $2);
        `;
        await client.query(assignQuestionQuery, [assignmentId, questionId]);

        // 4. Tạo đáp án
        const answers: Answer[] = [];
        for (const ans of question.answers) {
          const optionQuery = `
            INSERT INTO "Question_Options" (
              question_id,
              content,
              is_correct
            )
            VALUES ($1, $2, $3)
            RETURNING id;
          `;
          const answerResult = await client.query(optionQuery, [
            questionId,
            ans.content,
            ans.isCorrect,
          ]);

          answers.push({
            id: answerResult.rows[0].id,
            questionId: questionId,
            content: ans.content,
            isCorrect: ans.isCorrect,
          });
        }

        questions.push({
          id: questionId,
          assignmentId: assignmentId,
          content: question.content,
          type: question.type,
          answers: answers,
        });
      }

      await client.query("COMMIT");

      return {
        id: assignmentId,
        title: assignmentReq.title,
        description: assignmentReq.description,
        class_level: assignmentReq.class_level,
        subject: assignmentReq.subject,
        duration_minutes: assignmentReq.duration_minutes,
        teacher_id: teacher_id,
        questions: questions,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  getById: async (assignmentId: number): Promise<Assignment | null> => {
    const result = await pool.query(
      `
    SELECT
      a.id AS assignment_id,
      a.title,
      a.description,
      a.class_level,
      a.subject,
      a.duration_minutes,
      a.teacher_id,

      q.id AS question_id,
      q.content AS question_content,
      q.question_type,

      qo.id AS option_id,
      qo.content AS option_content,
      qo.is_correct

    FROM "Assignment" a

    LEFT JOIN "Assignment_Question" aq
      ON a.id = aq.assignment_id

    LEFT JOIN "Question" q
      ON aq.question_id = q.id

    LEFT JOIN "Question_Options" qo
      ON q.id = qo.question_id

    WHERE a.id = $1

    ORDER BY q.id, qo.id
    `,
      [assignmentId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const firstRow = result.rows[0];

    const assignment: Assignment = {
      id: firstRow.assignment_id,
      title: firstRow.title,
      description: firstRow.description,
      class_level: firstRow.class_level,
      subject: firstRow.subject,
      duration_minutes: firstRow.duration_minutes,
      teacher_id: firstRow.teacher_id,
      questions: [],
    };

    for (const row of result.rows) {
      let question = assignment.questions.find((q) => q.id === row.question_id);

      if (!question) {
        question = {
          id: row.question_id,
          assignmentId: assignment.id,
          content: row.question_content,
          type: row.question_type,
          answers: [],
        };

        assignment.questions.push(question);
      }

      if (row.option_id !== null) {
        question.answers.push({
          id: row.option_id,
          questionId: row.question_id,
          content: row.option_content,
          isCorrect: row.is_correct,
        });
      }
    }

    return assignment;
  },
  getByTeacherId: async (userId: number): Promise<Assignment[]> => {
    const result = await pool.query(
      `
    SELECT
      id,
      title,
      description,
      class_level,
      subject,
      duration_minutes,
      teacher_id
    FROM "Assignment"
    WHERE teacher_id = $1
    ORDER BY id DESC
    `,
      [userId],
    );

    return result.rows;
  },
};

export default AssignmentService;

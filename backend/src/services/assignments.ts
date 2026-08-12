import pool from "@/config/db.js";
import { type Answer, type AssignmentRequest, type Question } from "@/types/assignments.js";

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
        // Đã sửa: Bỏ dấu phẩy thừa sau question_type
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
};

export default AssignmentService;
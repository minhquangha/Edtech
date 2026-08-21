import pool from "@/config/db.js";
import {
  type Answer,
  type AssignmentRequest,
  type Question,
  type Assignment,
  type AssignmentUpdateRequest,
} from "@/types/assignments.js";

const AssignmentService = {
  create: async (
    assignmentReq: AssignmentRequest,
    teacher_id: number,
  ): Promise<Assignment> => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Tạo Assignment
      const assignmentQuery = `
        INSERT INTO "Assignment" (
          title,
          description,
          duration_minutes,
          teacher_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const assignmentResult = await client.query(assignmentQuery, [
        assignmentReq.title,
        assignmentReq.description,
        assignmentReq.duration_minutes,
        teacher_id
      ]);

      const assignmentId = assignmentResult.rows[0].id;

      // Cần tạo Assignment_lesson => cần lessonId và assigment id

      const lessonQuery = `
        INSERT INTO "Lesson_Assignment" (assignment_id, lesson_id)
        SELECT $1, unnest($2::int[]);
      `;
      await client.query(lessonQuery, [assignmentId, assignmentReq.lessonIds]);
      const questions: Question[] = [];
      // 2. Tạo Question + AssignmentQuestion + Question_Options
      for (const question of assignmentReq.questions) {
        const questionQuery = `
          INSERT INTO "Question" (
            content,
            question_type,
            answer
          )
          VALUES ($1, $2, $3)
          RETURNING id;
        `;
        const questionResult = await client.query(questionQuery, [
          question.content,
          question.question_type,
          question.answer || null,
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
        if (
          question.question_type === "SINGLE_CHOICE" ||
          question.question_type === "MULTIPLE_CHOICE" ||
          question.question_type === "TRUE_FALSE" ||
          question.question_type === "SHORT_ANSWER"
        ) {
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
            question_type: question.question_type,
            answers: answers,
          });
        }
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
    const metadataResult = await pool.query(
      `
      SELECT DISTINCT ON (a.id)
        a.id AS assignment_id,
        a.title,
        a.description,
        a.duration_minutes,
        a.teacher_id,

        s.id AS subject_id,
        s.subject AS subject,

        g.id AS grade_id,
        g.grade AS class_level
      FROM "Assignment" a
      LEFT JOIN "Lesson_Assignment" la
        ON a.id = la.assignment_id
      LEFT JOIN "Lessons" l
        ON la.lesson_id = l.id
      LEFT JOIN "Subjects" s
        ON l.subject_id = s.id
      LEFT JOIN "Grades" g
        ON l.grade_id = g.id
      WHERE a.id = $1
      ORDER BY a.id, la.lesson_id NULLS LAST
      `,
      [assignmentId],
    );

    if (metadataResult.rows.length === 0) {
      return null;
    }

    const firstRow = metadataResult.rows[0];

    const assignment: Assignment = {
      id: firstRow.assignment_id,
      title: firstRow.title,
      description: firstRow.description,
      duration_minutes: firstRow.duration_minutes,
      teacher_id: firstRow.teacher_id,
      subject: firstRow.subject,
      class_level: firstRow.class_level,
      questions: [],
    };

    const questionsResult = await pool.query(
      `
      SELECT
        q.id AS question_id,
        q.content AS question_content,
        q.question_type,
        q.answer AS question_answer,
        qo.id AS option_id,
        qo.content AS option_content,
        qo.is_correct
      FROM "Assignment_Question" aq
      INNER JOIN "Question" q
        ON aq.question_id = q.id
      LEFT JOIN "Question_Options" qo
        ON q.id = qo.question_id
      WHERE aq.assignment_id = $1
      ORDER BY q.id, qo.id
      `,
      [assignmentId],
    );

    const optionDedup = new Set<string>();

    for (const row of questionsResult.rows) {
      let question = assignment.questions.find((q) => q.id === row.question_id);

      if (!question) {
        question = {
          id: row.question_id,
          assignmentId: assignment.id,
          content: row.question_content,
          question_type: row.question_type,
          answer: row.question_answer,
          answers: [],
        };

        assignment.questions.push(question);
      }

      if (row.option_id !== null) {
        const dedupeKey = `${row.question_id}::${row.option_content}::${Boolean(row.is_correct)}`;
        if (optionDedup.has(dedupeKey)) continue;
        optionDedup.add(dedupeKey);

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
    SELECT DISTINCT ON (a.id)
      a.id,
      a.title,
      a.description,
      a.duration_minutes,
      a.teacher_id,
      s.id AS subject_id,
      s.subject AS subject,
      g.id AS grade_id,
      g.grade AS class_level
    FROM "Assignment" a
    LEFT JOIN "Lesson_Assignment" la
      ON la.assignment_id = a.id
    LEFT JOIN "Lessons" l
      ON l.id = la.lesson_id
    LEFT JOIN "Subjects" s
      ON s.id = l.subject_id
    LEFT JOIN "Grades" g
      ON g.id = l.grade_id
    WHERE a.teacher_id = $1
    ORDER BY a.id DESC
    `,
    [userId],
  );

  return result.rows;
},
  updateAssignment: async (
    assignmentId: number,
    teacherId: number,
    assignment: AssignmentUpdateRequest,
  ): Promise<void> => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // =====================================================
      // 1. Kiểm tra Assignment có thuộc teacher hiện tại không
      // =====================================================

      const assignmentResult = await client.query(
        `
        SELECT id
        FROM "Assignment"
        WHERE id = $1
          AND teacher_id = $2
        `,
        [assignmentId, teacherId],
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error("Assignment not found or you do not have permission");
      }

      // =====================================================
      // 2. Update thông tin Assignment
      // =====================================================

      await client.query(
        `
        UPDATE "Assignment"
        SET
          title = $1,
          description = $2,
          class_level = $3,
          duration_minutes = $4,
          subject = $5
        WHERE id = $6
        `,
        [
          assignment.title,
          assignment.description,
          assignment.class_level,
          assignment.duration_minutes,
          assignment.subject,
          assignmentId,
        ],
      );

      // =====================================================
      // 3. Lấy danh sách Question hiện tại của Assignment
      // =====================================================

      const oldQuestionsResult = await client.query(
        `
        SELECT question_id
        FROM "Assignment_Question"
        WHERE assignment_id = $1
        `,
        [assignmentId],
      );

      const oldQuestionIds: number[] = oldQuestionsResult.rows.map((row) =>
        Number(row.question_id),
      );

      // Danh sách question ID frontend gửi lên
      const requestQuestionIds: number[] = assignment.questions.map(
        (question) => question.id,
      );

      // =====================================================
      // 4. Xử lý từng Question
      // =====================================================

      for (const question of assignment.questions) {
        // ---------------------------------------------------
        // Kiểm tra Question có thực sự thuộc Assignment này
        // ---------------------------------------------------

        const questionCheck = await client.query(
          `
          SELECT q.id
          FROM "Question" q
          INNER JOIN "Assignment_Question" aq
            ON aq.question_id = q.id
          WHERE q.id = $1
            AND aq.assignment_id = $2
          `,
          [question.id, assignmentId],
        );

        if (questionCheck.rows.length === 0) {
          throw new Error(
            `Question ${question.id} does not belong to assignment ${assignmentId}`,
          );
        }

        // ---------------------------------------------------
        // Update Question
        // ---------------------------------------------------

        await client.query(
          `
          UPDATE "Question"
          SET
            content = $1,
            question_type = $2
          WHERE id = $3
          `,
          [question.content, question.question_type, question.id],
        );

        // ===================================================
        // Lấy danh sách Answer hiện tại của Question
        // ===================================================

        const oldAnswersResult = await client.query(
          `
          SELECT id
          FROM "Question_Options"
          WHERE question_id = $1
          `,
          [question.id],
        );

        const oldAnswerIds: number[] = oldAnswersResult.rows.map((row) =>
          Number(row.id),
        );

        const requestAnswerIds: number[] = question.answers.map(
          (answer) => answer.id,
        );

        // ===================================================
        // Update Answer
        // ===================================================

        for (const answer of question.answers) {
          const answerResult = await client.query(
            `
            UPDATE "Question_Options"
            SET
              content = $1,
              is_correct = $2
            WHERE id = $3
              AND question_id = $4
            `,
            [answer.content, answer.isCorrect, answer.id, question.id],
          );

          if (answerResult.rowCount === 0) {
            throw new Error(
              `Answer ${answer.id} does not belong to question ${question.id}`,
            );
          }
        }

        // ===================================================
        // Xóa Answer bị giáo viên xóa khỏi frontend
        // ===================================================

        const answersToDelete = oldAnswerIds.filter(
          (id) => !requestAnswerIds.includes(id),
        );

        if (answersToDelete.length > 0) {
          await client.query(
            `
            DELETE FROM "Question_Options"
            WHERE id = ANY($1::int[])
              AND question_id = $2
            `,
            [answersToDelete, question.id],
          );
        }
      }

      // =====================================================
      // 5. Xử lý Question bị giáo viên xóa
      // =====================================================

      const questionsToDelete = oldQuestionIds.filter(
        (id) => !requestQuestionIds.includes(id),
      );

      for (const questionId of questionsToDelete) {
        // -----------------------------------------------
        // Xóa Answer
        // -----------------------------------------------

        await client.query(
          `
          DELETE FROM "Question_Options"
          WHERE question_id = $1
          `,
          [questionId],
        );

        // -----------------------------------------------
        // Xóa quan hệ AssignmentQuestion
        // -----------------------------------------------

        await client.query(
          `
          DELETE FROM "Assignment_Question"
          WHERE assignment_id = $1
            AND question_id = $2
          `,
          [assignmentId, questionId],
        );

        // -----------------------------------------------
        // Kiểm tra Question còn được Assignment khác dùng
        // không
        // -----------------------------------------------

        const questionUsageResult = await client.query(
          `
            SELECT 1
            FROM "Assignment_Question"
            WHERE question_id = $1
            LIMIT 1
            `,
          [questionId],
        );

        // Nếu không còn Assignment nào sử dụng
        // thì mới xóa Question
        if (questionUsageResult.rows.length === 0) {
          await client.query(
            `
            DELETE FROM "Question"
            WHERE id = $1
            `,
            [questionId],
          );
        }
      }

      // =====================================================
      // 6. Commit transaction
      // =====================================================

      await client.query("COMMIT");
    } catch (error) {
      // =====================================================
      // Có lỗi -> rollback toàn bộ
      // =====================================================

      await client.query("ROLLBACK");

      console.error("Update assignment error:", error);

      throw error;
    } finally {
      // =====================================================
      // Trả connection về pool
      // =====================================================

      client.release();
    }
  },
  deleteById: async (
    assignmentId: number,
    teacherId: number,
  ): Promise<void> => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Kiểm tra assignment có tồn tại
      //    và thuộc teacher hiện tại không
      const assignmentResult = await client.query(
        `
        SELECT id
        FROM "Assignment"
        WHERE id = $1
          AND teacher_id = $2
        `,
        [assignmentId, teacherId],
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error("Assignment not found or you do not have permission");
      }

      // 2. Lấy các question thuộc assignment
      const questionResult = await client.query(
        `
        SELECT question_id
        FROM "Assignment_Question"
        WHERE assignment_id = $1
        `,
        [assignmentId],
      );

      const questionIds: number[] = questionResult.rows.map((row) =>
        Number(row.question_id),
      );

      // 3. Xóa quan hệ Assignment - Question
      await client.query(
        `
        DELETE FROM "Assignment_Question"
        WHERE assignment_id = $1
        `,
        [assignmentId],
      );

      // 4. Xóa các option của question
      if (questionIds.length > 0) {
        await client.query(
          `
          DELETE FROM "Question_Options"
          WHERE question_id = ANY($1::int[])
          `,
          [questionIds],
        );

        // 5. Xóa question
        await client.query(
          `
          DELETE FROM "Question"
          WHERE id = ANY($1::int[])
          `,
          [questionIds],
        );
      }

      // 6. Xóa assignment
      await client.query(
        `
        DELETE FROM "Assignment"
        WHERE id = $1
          AND teacher_id = $2
        `,
        [assignmentId, teacherId],
      );

      // 7. Thành công
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Delete assignment error:", error);

      throw error;
    } finally {
      client.release();
    }
  },
  getGrades: async (): Promise<any[]> => {
    return [];
  },
  getSubject: async (gradeId: number): Promise<any[]> => {
    const result = await pool.query(
      `
        SELECT DISTINCT
            s.id,
            s.subject
        FROM "Subjects" s
        JOIN "Lessons" l
            ON l.subject_id = s.id
        WHERE l.grade_id = $1
        ORDER BY s.subject ASC
        `,
      [gradeId],
    );

    return result.rows;
  },
  getLessons: async (gradeId: number, subjectId: number): Promise<any[]> => {
    const result = await pool.query(
      `
        SELECT
            id,
            lesson_number,
            title
        FROM "Lessons"
        WHERE grade_id = $1
          AND subject_id = $2
        ORDER BY lesson_number ASC
        `,
      [gradeId, subjectId],
    );

    return result.rows;
  },
  getLessonsContent: async (lessonIds: number[]): Promise<any[]> => {
    const result = await pool.query(
      `
        SELECT
            id,
            lesson_number,
            title,
            content
        FROM "Lessons"
        WHERE id = ANY($1::int[])
        ORDER BY lesson_number ASC
        `,
      [lessonIds],
    );

    return result.rows;
  },
};

export default AssignmentService;

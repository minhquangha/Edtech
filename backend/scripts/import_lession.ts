import fs from "fs";
import path from "path";
import pool from "@/config/db.js";

interface LessonData {
  _id?: {
    $oid?: string;
  };
  grade: string;
  lesson: string;
  subject: string;
  content: string;
  title: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");

async function importLessons() {
  const client = await pool.connect();

  try {
    const files = fs
      .readdirSync(DATA_DIR)
      .filter((file) => file.endsWith(".json"));

    if (files.length === 0) {
      console.log("Không tìm thấy file JSON trong folder data.");
      return;
    }

    console.log(`Tìm thấy ${files.length} file JSON.`);

    await client.query("BEGIN");

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);

      console.log(`\nĐang đọc: ${file}`);

      const rawData = fs.readFileSync(filePath, "utf-8");
      const data: LessonData[] = JSON.parse(rawData);

      if (!Array.isArray(data)) {
        console.log(`Bỏ qua ${file}: dữ liệu không phải array.`);
        continue;
      }

      for (const lesson of data) {
        const grade = Number(lesson.grade);
        const lessonNumber = Number(lesson.lesson);
        const subject = lesson.subject?.trim();
        const title = lesson.title?.trim();
        const content = lesson.content;

        if (
          !grade ||
          !lessonNumber ||
          !subject ||
          !title ||
          !content
        ) {
          console.log(
            `Bỏ qua lesson không hợp lệ trong file ${file}:`,
            lesson
          );
          continue;
        }

        // 1. Tìm hoặc tạo Grade
        const gradeResult = await client.query(
          `
          INSERT INTO "Grades" (grade)
          VALUES ($1)
          ON CONFLICT (grade)
          DO UPDATE SET grade = EXCLUDED.grade
          RETURNING id;
          `,
          [grade]
        );

        const gradeId = gradeResult.rows[0].id;

        // 2. Tìm hoặc tạo Subject
        const subjectResult = await client.query(
          `
          INSERT INTO "Subjects" (subject)
          VALUES ($1)
          ON CONFLICT (subject)
          DO UPDATE SET subject = EXCLUDED.subject
          RETURNING id;
          `,
          [subject]
        );

        const subjectId = subjectResult.rows[0].id;

        // 3. Insert Lesson
        const lessonResult = await client.query(
          `
          INSERT INTO "Lessons" (
            content,
            title,
            lesson_number,
            subject_id,
            grade_id
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (
            subject_id,
            grade_id,
            lesson_number
          )
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content
          RETURNING id;
          `,
          [
            content,
            title,
            lessonNumber,
            subjectId,
            gradeId,
          ]
        );

        console.log(
          `✓ ${subject} - Lớp ${grade} - Bài ${lessonNumber} - Lesson ID: ${lessonResult.rows[0].id}`
        );
      }
    }

    await client.query("COMMIT");

    console.log("\n==============================");
    console.log("Import dữ liệu thành công!");
    console.log("==============================");
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("\nImport thất bại!");
    console.error(error);

    process.exitCode = 1;
  } finally {
    client.release();
  }
}

importLessons();
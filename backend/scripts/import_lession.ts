import fs from "fs";
import path from "path";
import prisma from "@/config/prisma.js";

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
  try {
    const files = fs
      .readdirSync(DATA_DIR)
      .filter((file) => file.endsWith(".json"));

    if (files.length === 0) {
      console.log("Không tìm thấy file JSON trong folder data.");
      return;
    }

    console.log(`Tìm thấy ${files.length} file JSON.`);

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
        const dbGrade = await prisma.grade.upsert({
          where: { grade },
          update: {},
          create: { grade },
        });

        // 2. Tìm hoặc tạo Subject
        const dbSubject = await prisma.subject.upsert({
          where: { subject },
          update: {},
          create: { subject },
        });

        // 3. Insert / Update Lesson
        const dbLesson = await prisma.lesson.upsert({
          where: {
            subject_id_grade_id_lesson_number: {
              subject_id: dbSubject.id,
              grade_id: dbGrade.id,
              lesson_number: lessonNumber,
            },
          },
          update: {
            title,
            content,
          },
          create: {
            title,
            content,
            lesson_number: lessonNumber,
            subject_id: dbSubject.id,
            grade_id: dbGrade.id,
          },
        });

        console.log(
          `✓ ${subject} - Lớp ${grade} - Bài ${lessonNumber} - Lesson ID: ${dbLesson.id}`
        );
      }
    }

    console.log("\n==============================");
    console.log("Import dữ liệu thành công!");
    console.log("==============================");
  } catch (error) {
    console.error("\nImport thất bại!");
    console.error(error);
    process.exitCode = 1;
  }
}

importLessons();
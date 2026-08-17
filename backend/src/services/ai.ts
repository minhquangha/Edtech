import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";
import pool from "@/config/db.js";

const AiService = {
  create: async (demand: AiRequest): Promise<AssignmentRequest> => {
    try {
      const {
        class_level,
        subject,
        title,
        description,
        time_duration,
        question_config,
      } = demand.data;

      const { groups } = question_config;

      // ==========================================
      // 1. Validate groups
      // ==========================================

      if (!groups || groups.length === 0) {
        throw new Error("At least one question group is required");
      }

      // ==========================================
      // 2. Lấy tất cả lessonIds từ các groups
      // ==========================================

      const allLessonIds = [
        ...new Set(
          groups.flatMap((group) => group.lessonIds)
        ),
      ];

      if (allLessonIds.length === 0) {
        throw new Error("At least one lesson must be selected");
      }

      // ==========================================
      // 3. Query tất cả Lessons một lần
      // ==========================================

      const lessonResult = await pool.query(
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
        [allLessonIds],
      );

      const lessons = lessonResult.rows;

      // ==========================================
      // 4. Kiểm tra tất cả lessonIds có tồn tại
      // ==========================================

      if (lessons.length !== allLessonIds.length) {
        const existingLessonIds = new Set(
          lessons.map((lesson) => lesson.id)
        );

        const missingLessonIds = allLessonIds.filter(
          (id) => !existingLessonIds.has(id)
        );

        throw new Error(
          `Lessons not found: ${missingLessonIds.join(", ")}`
        );
      }

      // ==========================================
      // 5. Tạo Map để lấy lesson nhanh
      // ==========================================

      const lessonMap = new Map(
        lessons.map((lesson) => [lesson.id, lesson])
      );

      // ==========================================
      // 6. Tính tổng số câu hỏi
      // ==========================================

      const totalQuestions = groups.reduce(
        (total, group) => total + group.count,
        0,
      );

      // ==========================================
      // 7. Tạo nội dung từng group
      // ==========================================

      const questionDistribution = groups
        .map((group, index) => {
          const groupLessons = group.lessonIds.map((lessonId) => {
            const lesson = lessonMap.get(lessonId);

            if (!lesson) {
              throw new Error(
                `Lesson ${lessonId} not found`
              );
            }

            return `
Lesson ${lesson.lesson_number}
Title: ${lesson.title}

Content:
${lesson.content}
`;
          });

          return `
========================
GROUP ${index + 1}
========================

Number of questions:
${group.count}

Difficulty:
${group.difficulty}

Question type:
${group.type}

SOURCE LESSONS:
${groupLessons.join("\n")}
`;
        })
        .join("\n");

      // ==========================================
      // 8. Prompt
      // ==========================================

      const prompt = `
You are an AI assistant specialized in creating educational assignments.

Your task is to generate a complete assignment based on the teacher's
requirements and the source lesson content provided for each question group.

========================
ASSIGNMENT INFORMATION
========================

Title:
${title}

Description:
${description ?? "No description provided"}

Class level:
${class_level}

Subject:
${subject}

Duration:
${time_duration} minutes

========================
QUESTION GROUPS
========================

${questionDistribution}

========================
GENERATION RULES
========================

1. Generate exactly ${totalQuestions} questions.

2. You MUST follow the question distribution specified for each group.

3. Each group MUST generate questions ONLY from the source lesson content
provided inside that group.

4. Do NOT use knowledge outside the provided lesson content.

5. Questions must be appropriate for:
"${class_level}"

6. Questions must be related to the subject:
"${subject}"

7. For each group, generate exactly the specified number of questions.

8. Each question must have the exact difficulty specified by its group.

9. Each question must have the exact question type specified by its group.

10. Questions must be clear, educational, and unambiguous.

11. Do not generate duplicate questions.

12. Each question must contain multiple answer options.

13. Every answer option must contain:
    - content
    - isCorrect

14. For SINGLE_CHOICE questions:
    - There must be exactly ONE answer with isCorrect = true.
    - All other answers must have isCorrect = false.

15. For MULTIPLE_CHOICE questions:
    - There must be at least ONE answer with isCorrect = true.
    - There may be multiple correct answers.

16. Do not include the difficulty field in the question output.

17. Do not include any field that is not defined in the required JSON schema.

18. Do not include group information in the final JSON.

19. Return only the assignment JSON.

20. Do not return markdown.

21. Do not return explanations before or after the JSON.

22. Make sure the total number of generated questions is exactly ${totalQuestions}.

Generate the assignment now.
`;

      // ==========================================
      // 9. Call Gemini
      // ==========================================

      const response = await gemini.models.generateContent({
        model: "gemini-3.6-flash",

        contents: prompt,

        config: {
          responseMimeType: "application/json",
          responseSchema: assignmentAiSchema,
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response");
      }

      const assignment: AssignmentRequest = JSON.parse(
        response.text
      );

      return assignment;
    } catch (error) {
      console.error(
        "AI Service - generate assignment error:",
        error
      );

      throw error;
    }
  },
};

export default AiService;
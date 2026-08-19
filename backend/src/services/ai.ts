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
        ...new Set(groups.flatMap((group) => group.lessonIds)),
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
        const existingLessonIds = new Set(lessons.map((lesson) => lesson.id));

        const missingLessonIds = allLessonIds.filter(
          (id) => !existingLessonIds.has(id),
        );

        throw new Error(`Lessons not found: ${missingLessonIds.join(", ")}`);
      }

      // ==========================================
      // 5. Tạo Map để lấy lesson nhanh
      // ==========================================

      const lessonMap = new Map(lessons.map((lesson) => [lesson.id, lesson]));

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
              throw new Error(`Lesson ${lessonId} not found`);
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

12. The structure of the answer data MUST depend on the question type.

13. For SINGLE_CHOICE questions:

    - "question_type" MUST be "SINGLE_CHOICE".
    - "answers" MUST contain at least 2 options.
    - Each answer option MUST contain:
        - content
        - isCorrect
    - There MUST be exactly ONE answer with isCorrect = true.
    - All other answers MUST have isCorrect = false.
    - "answer" MUST be null.

14. For MULTIPLE_CHOICE questions:

    - "question_type" MUST be "MULTIPLE_CHOICE".
    - "answers" MUST contain at least 2 options.
    - Each answer option MUST contain:
        - content
        - isCorrect
    - There MUST be at least ONE answer with isCorrect = true.
    - There MAY be multiple answers with isCorrect = true.
    - "answer" MUST be null.

15. For TRUE_FALSE questions:

    - "question_type" MUST be "TRUE_FALSE".
    - "answers" MUST be an empty array [].
    - DO NOT create answer options for TRUE_FALSE questions.
    - "answer" MUST be either the string "true" or the string "false".
    - The answer MUST represent the correct answer to the statement.
    - The statement must be clear and objectively determined from the provided lesson content.

    Example:

    {
      "content": "The Earth revolves around the Sun.",
      "question_type": "TRUE_FALSE",
      "answer": "true",
      "answers": []
    }

16. For SHORT_ANSWER questions:

    - "question_type" MUST be "SHORT_ANSWER".
    - "answers" MUST be an empty array [].
    - DO NOT create answer options for SHORT_ANSWER questions.
    - "answer" MUST be a non-empty string.
    - The answer must be short, clear, and directly supported by the provided lesson content.
    - Do not provide multiple possible answers unless the question explicitly requires them.

    Example:

    {
      "content": "What is the capital of Vietnam?",
      "question_type": "SHORT_ANSWER",
      "answer": "Hanoi",
      "answers": []
    }

17. The following rules MUST always apply:

    SINGLE_CHOICE:
        answer = null
        answers = array of options

    MULTIPLE_CHOICE:
        answer = null
        answers = array of options

    TRUE_FALSE:
        answer = "true" or "false"
        answers = []

    SHORT_ANSWER:
        answer = string
        answers = []

18. Do NOT create Question Options for TRUE_FALSE or SHORT_ANSWER.

19. Do NOT put TRUE_FALSE answers such as "True" and "False" inside the "answers" array.

20. Do NOT put SHORT_ANSWER answers inside the "answers" array.

21. Do not include the difficulty field in the question output.

22. Do not include any field that is not defined in the required JSON schema.

23. Do not include group information in the final JSON.

24. Return only the assignment JSON.

25. Do not return markdown.

26. Do not return explanations before or after the JSON.

27. Make sure the total number of generated questions is exactly ${totalQuestions}.

28. Before returning the final JSON, internally verify:

    - The number of questions is exactly ${totalQuestions}.
    - Every question has the correct question_type.
    - SINGLE_CHOICE has exactly one correct option.
    - MULTIPLE_CHOICE has at least one correct option.
    - TRUE_FALSE has answer = "true" or "false" and answers = [].
    - SHORT_ANSWER has a non-empty answer and answers = [].
    - No question type contains an invalid answer structure.

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

      const assignment: AssignmentRequest = JSON.parse(response.text);

      return assignment;
    } catch (error) {
      console.error("AI Service - generate assignment error:", error);

      throw error;
    }
  },
};

export default AiService;

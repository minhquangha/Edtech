import type { AiRequest } from "@/types/ai-service.js";
import type { AssignmentRequest } from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";

const AiService = {
  create: async (demand: AiRequest): Promise<AssignmentRequest> => {
    try {
      const {
        class_level,
        subject,
        topic,
        title,
        description,
        time_duration,
        question_config,
      } = demand.data;

      const { groups } = question_config;

      // Tính tổng số câu hỏi
      const totalQuestions = groups.reduce(
        (total, group) => total + group.count,
        0,
      );

      // Chuyển cấu hình groups thành nội dung cho prompt
      const questionDistribution = groups
        .map(
          (group, index) => `
Group ${index + 1}:
- Number of questions: ${group.count}
- Difficulty: ${group.difficulty}
- Question type: ${group.type}
`,
        )
        .join("\n");

      const prompt = `
You are an AI assistant specialized in creating educational assignments.

Your task is to generate a complete assignment based on the teacher's requirements.

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

Topic:
${topic}

Duration:
${time_duration} minutes

========================
QUESTION REQUIREMENTS
========================

The assignment contains exactly ${totalQuestions} questions.

The teacher has configured the questions into the following groups:

${questionDistribution}

========================
GENERATION RULES
========================

1. Generate exactly ${totalQuestions} questions.

2. You MUST follow the question distribution specified above.

3. Every question must be related to the subject:
"${subject}"

4. Every question must focus on the topic:
"${topic}"

5. Every question must be appropriate for:
"${class_level}"

6. For each group, generate exactly the specified number of questions.

7. Each question must have the exact difficulty specified by its group.

8. Each question must have the exact question type specified by its group.

9. Questions must be clear, educational, and unambiguous.

10. Do not generate duplicate questions.

11. Each question must contain multiple answer options.

12. Every answer option must contain:
    - content
    - isCorrect

13. For SINGLE_CHOICE questions:
    - There must be exactly ONE answer with isCorrect = true.
    - All other answers must have isCorrect = false.

14. For MULTIPLE_CHOICE questions:
    - There must be at least ONE answer with isCorrect = true.
    - There may be multiple correct answers.

15. Do not include the difficulty field in the question output.

16. Do not include any field that is not defined in the required JSON schema.

17. Do not include the group information in the final JSON.

18. Return only the assignment JSON.

19. Do not return markdown.

20. Do not return explanations before or after the JSON.

21. Make sure the total number of generated questions is exactly ${totalQuestions}.

Generate the assignment now.
`;

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

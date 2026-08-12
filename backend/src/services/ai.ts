import type { AiRequest } from "@/types/ai-service.js";
import type {  AssignmentRequest} from "@/types/assignments.js";

import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/models/ai-schema.js";

const AiService = {
  create: async (
    demand: AiRequest
  ): Promise<AssignmentRequest> => {
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

      const {
        question_counts,
        difficulty,
        question_types,
      } = question_config;

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

Number of questions:
${question_counts}

Difficulty:
${difficulty}

Question type:
${question_types}

========================
GENERATION RULES
========================

1. Generate exactly ${question_counts} questions.

2. Every question must be related to the subject:
"${subject}"

3. Every question must focus on the topic:
"${topic}"

4. Every question must be appropriate for:
"${class_level}"

5. Every question must have the difficulty:
"${difficulty}"

6. Every question must have this type:
"${question_types}"

7. Questions must be clear, educational, and unambiguous.

8. Do not generate duplicate questions.

9. Each question must contain multiple answer options.

10. Every answer option must contain:
   - content
   - isCorrect

11. For SINGLE_CHOICE questions:
   - There must be exactly ONE answer with isCorrect = true.
   - All other answers must have isCorrect = false.

12. For MULTIPLE_CHOICE questions:
   - There may be multiple correct answers.
   - At least ONE answer must have isCorrect = true.

13. Do not include the correct answer outside the answers array.

14. Do not add any fields that are not defined in the required JSON schema.

15. Return only the assignment JSON.

16. Do not return markdown.

17. Do not return explanations before or after the JSON.

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
        throw new Error(
          "Gemini returned an empty response"
        );
      }

      const assignment: AssignmentRequest =
        JSON.parse(response.text);

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
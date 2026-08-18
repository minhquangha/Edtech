export const assignmentAiSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
    },

    description: {
      type: "string",
    },

    class_level: {
      type: "string",
    },

    duration_minutes: {
      type: "integer",
    },

    subject: {
      type: "string",
    },

    questions: {
      type: "array",

      items: {
        type: "object",

        properties: {
          content: {
            type: "string",
          },

          type: {
            type: "string",
            enum: [
              "MULTIPLE_CHOICE",
              "SINGLE_CHOICE",
              "TRUE_FALSE",
              "SHORT_ANSWER",
            ],
          },

          answer: {
            type: "string",
          },

          answers: {
            type: "array",

            items: {
              type: "object",

              properties: {
                content: {
                  type: "string",
                },

                isCorrect: {
                  type: "boolean",
                },
              },

              required: [
                "content",
                "isCorrect",
              ],
            },
          },
        },

        required: [
          "content",
          "type",
          "answers",
        ],
      },
    },
  },

  required: [
    "title",
    "description",
    "class_level",
    "duration_minutes",
    "subject",
    "questions",
  ],
};
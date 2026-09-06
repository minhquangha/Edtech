export declare const assignmentAiSchema: {
    type: string;
    properties: {
        title: {
            type: string;
        };
        description: {
            type: string;
        };
        class_level: {
            type: string;
        };
        duration_minutes: {
            type: string;
        };
        subject: {
            type: string;
        };
        questions: {
            type: string;
            items: {
                type: string;
                properties: {
                    content: {
                        type: string;
                    };
                    type: {
                        type: string;
                        enum: string[];
                    };
                    answer: {
                        type: string;
                    };
                    cognitive_level: {
                        type: string;
                        enum: string[];
                    };
                    answers: {
                        type: string;
                        items: {
                            type: string;
                            properties: {
                                content: {
                                    type: string;
                                };
                                isCorrect: {
                                    type: string;
                                };
                            };
                            required: string[];
                        };
                    };
                };
                required: string[];
            };
        };
    };
    required: string[];
};
//# sourceMappingURL=ai-schema.d.ts.map
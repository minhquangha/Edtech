import prisma from "@/config/prisma.js";
export const UploadExamRepository = {
    saveRawText: async (rawText, userId, fileName, fileSize, mimeType, extractionMethod) => {
        return await prisma.uploadedExam.create({
            data: {
                userId,
                fileName,
                fileSize,
                mimeType,
                rawText,
                extractionMethod,
            },
        });
    },
};
//# sourceMappingURL=uploaded_exam.repository.js.map
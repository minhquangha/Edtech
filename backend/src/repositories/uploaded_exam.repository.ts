import prisma from "@/config/prisma.js";
export const UploadExamRepository = {
    saveRawText: async (
        rawText: string,
        userId: number,
        fileName: string,
        fileSize: number,
        mimeType: string,
        extractionMethod: "PDF_TEXT" | "OCR"
    ) => {
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
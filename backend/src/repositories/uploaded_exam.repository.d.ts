export declare const UploadExamRepository: {
    saveRawText: (rawText: string, userId: number, fileName: string, fileSize: number, mimeType: string, extractionMethod: "PDF_TEXT" | "OCR") => Promise<{
        id: number;
        fileName: string;
        fileSize: bigint | null;
        mimeType: string | null;
        rawText: string;
        extractionMethod: import("@prisma/client").$Enums.extraction_method_t;
        createdAt: Date | null;
        updatedAt: Date | null;
        userId: number;
    }>;
};
//# sourceMappingURL=uploaded_exam.repository.d.ts.map
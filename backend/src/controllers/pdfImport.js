import { UploadExamRepository } from "@/repositories/uploaded_exam.repository.js";
import PdfImportService from "@/services/pdfImport.js";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { extraction_method_t } from "@prisma/client";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
function validateUploadedFiles(files) {
    if (files.length === 0) {
        return "Vui lòng tải lên ít nhất 1 file PDF";
    }
    if (files.length > MAX_FILES) {
        return `Chỉ được tải lên tối đa ${MAX_FILES} file PDF`;
    }
    for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
            return `File "${file.originalname}" vượt quá giới hạn 10MB`;
        }
        if (file.mimetype !== "application/pdf") {
            return `File "${file.originalname}" không phải là PDF`;
        }
    }
    return null;
}
const PdfImportController = {
    import: async (req, res) => {
        try {
            const files = req.files;
            if (!files) {
                return res.status(400).json({
                    message: "Vui lòng tải lên ít nhất 1 file PDF",
                });
            }
            // 1. Validate uploaded files
            const validationError = validateUploadedFiles(files);
            if (validationError) {
                return res.status(400).json({
                    message: validationError,
                });
            }
            // 2. Extract text from PDFs
            const parsedFiles = [];
            for (const file of files) {
                try {
                    const extractionResult = await PdfExtractorService.extractPdfContent(file.buffer);
                    const text = extractionResult.rawText;
                    const extraction_method = extractionResult.extractionMethod;
                    parsedFiles.push({
                        originalname: file.originalname,
                        text,
                    });
                    if (req.user === undefined) {
                        throw new Error("User not authenticated");
                    }
                    await UploadExamRepository.saveRawText(text, req.user.id, file.originalname, file.size, file.mimetype, extraction_method);
                    console.log("Đã lưu ");
                }
                catch (error) {
                    console.error(`PDF parse error for ${file.originalname}:`, error);
                    return res.status(400).json({
                        message: `Không thể đọc nội dung file "${file.originalname}"`,
                    });
                }
            }
            // 3. Send extracted text to AI service
            const assignment = await PdfImportService.generateFromPdfs({
                files: parsedFiles,
            });
            // 4. Return generated assignment
            return res.status(200).json({
                message: "Assignment generated from PDF successfully",
                data: assignment,
            });
        }
        catch (error) {
            console.error("PDF Import Controller Error:", error);
            const message = error instanceof Error
                ? error.message
                : "Failed to generate assignment from PDF";
            return res.status(500).json({
                message,
            });
        }
    },
};
export default PdfImportController;
//# sourceMappingURL=pdfImport.js.map
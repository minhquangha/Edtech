import type { Request, Response } from "express";
import { pdf } from "pdf-to-img";
import { PDFParse } from "pdf-parse";

import Tesseract from "tesseract.js";
import PdfImportService from "@/services/pdfImport.js";
import type { AssignmentRequest } from "@/types/assignments.js";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ParsedPdfFile {
  originalname: string;
  text: string;
}


function hasMeaningfulText(text:string) {
    if (!text) {
        return false;
    }

    // Loại bỏ các marker/metadata do PDF parser sinh ra
    const cleanedText = text
        .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
        .trim();

    return cleanedText.length > 0;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: buffer });
  const result = await pdf.getText();

  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object") {
    const r = result as {
      pages?: unknown[];
      text?: string;
    };

    if (typeof r.text === "string") {
      return r.text;
    }

    if (Array.isArray(r.pages)) {
      return r.pages
        .map((page: unknown) => {
          if (typeof page === "string") {
            return page;
          }

          if (page && typeof page === "object" && "text" in page) {
            return String((page as { text: unknown }).text ?? "");
          }

          return "";
        })
        .join("\n\n");
    }
  }

  return "";
}

async function extractPdfTextUsingOCR(buffer: Buffer): Promise<string> {
  const document = await pdf(buffer, {
    scale: 2,
  });
  let fullText = "";
  let pageNumber = 0;
  for await (const image of document) {
    pageNumber++;

    console.log(`\nĐang OCR trang ${pageNumber}...`);

    const result = await Tesseract.recognize(image, "vie");

    const text = result.data.text;

    console.log(`OCR trang ${pageNumber} hoàn thành`);

    fullText += `--- Trang ${pageNumber} ---\n`;

    fullText += text.trim();

    fullText += "\n\n";
  }
  document.destroy();
  return fullText;
}

function validateUploadedFiles(files: Express.Multer.File[]): string | null {
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
  import: async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

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
      const parsedFiles: ParsedPdfFile[] = [];

      for (const file of files) {
        try {
          let text = await extractPdfText(file.buffer);
          
          if (!hasMeaningfulText(text)) {
            //extractPdfWithOcr
            console.log("cần ocr");
            text = await extractPdfTextUsingOCR(file.buffer);
            // return res.status(400).json({
            //   message:
            //     `File "${file.originalname}" không có text layer. ` +
            //     `Có thể đây là file PDF quét ảnh (scan). ` +
            //     `Vui lòng sử dụng PDF có chứa text.`,
            // });
          }
          console.log("ko can ocr");
          console.log(text);
          parsedFiles.push({
            originalname: file.originalname,
            text,
          });
        } catch (error) {
          console.error(`PDF parse error for ${file.originalname}:`, error);

          return res.status(400).json({
            message: `Không thể đọc nội dung file "${file.originalname}"`,
          });
        }
      }

      // 3. Send extracted text to AI service
      const assignment: AssignmentRequest =
        await PdfImportService.generateFromPdfs({
          files: parsedFiles,
        });

      // 4. Return generated assignment
      return res.status(200).json({
        message: "Assignment generated from PDF successfully",
        data: assignment,
      });
    } catch (error) {
      console.error("PDF Import Controller Error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate assignment from PDF";

      return res.status(500).json({
        message,
      });
    }
  },
};

export default PdfImportController;

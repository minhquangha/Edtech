import type { Request, Response } from "express";
import { PDFParse } from "pdf-parse";
import PdfImportService from "@/services/pdfImport.js";
import type { AssignmentRequest, CognitiveLevel } from "@/types/assignments.js";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: buffer });
  const result = await pdf.getText();
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as { pages?: unknown[]; text?: string };
    if (typeof r.text === "string") return r.text;
    if (Array.isArray(r.pages)) {
      return r.pages
        .map((p: unknown) => {
          if (typeof p === "string") return p;
          if (p && typeof p === "object" && "text" in p) {
            return String((p as { text: unknown }).text ?? "");
          }
          return "";
        })
        .join("\n\n");
    }
  }
  return "";
}

const PdfImportController = {
  import: async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Vui lòng tải lên ít nhất 1 file PDF" });
      }

      if (files.length > MAX_FILES) {
        return res.status(400).json({ message: `Chỉ được tải lên tối đa ${MAX_FILES} file PDF` });
      }

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          return res.status(400).json({ message: `File "${file.originalname}" vượt quá giới hạn 10MB` });
        }

        if (file.mimetype !== "application/pdf") {
          return res.status(400).json({ message: `File "${file.originalname}" không phải là PDF` });
        }
      }

      const {
        title,
        description,
        subject,
        class_level,
        grade_id,
        duration_minutes,
        question_groups,
        extra_requirements,
      } = req.body;

      const parsedFiles: { originalname: string; text: string }[] = [];

      for (const file of files) {
        try {
          const text = await extractPdfText(file.buffer);
          if (!text.trim()) {
            return res.status(400).json({
              message: `File "${file.originalname}" không có text layer. Có thể đây là file PDF quét ảnh (scan). Vui lòng dùng file PDF có chứa text.`,
            });
          }

          parsedFiles.push({ originalname: file.originalname, text });
        } catch (err) {
          console.error(`PDF parse error for ${file.originalname}:`, err);
          return res.status(400).json({ message: `Không thể đọc nội dung file "${file.originalname}"` });
        }
      }

      let parsedGroups: Array<{
        type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
        count: number;
        difficulty: CognitiveLevel;
      }> = [];

      if (question_groups) {
        try {
          const raw = typeof question_groups === "string" ? JSON.parse(question_groups) : question_groups;
          if (Array.isArray(raw) && raw.length > 0) {
            parsedGroups = raw.map((g: any) => ({
              type: String(g.type) as "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
              count: Number(g.count) || 1,
              difficulty: (String(g.difficulty) as CognitiveLevel) || "TH",
            }));
          }
        } catch {
          return res.status(400).json({ message: "question_groups không đúng định dạng JSON" });
        }
      }

      if (parsedGroups.length === 0) {
        return res.status(400).json({ message: "Vui lòng cấu hình ít nhất 1 nhóm câu hỏi" });
      }

      const assignment: AssignmentRequest = await PdfImportService.generateFromPdfs({
        files: parsedFiles,
        title: title || undefined,
        description: description || undefined,
        subject: subject || undefined,
        classLevel: class_level || undefined,
        gradeId: grade_id ? Number(grade_id) : undefined,
        durationMinutes: duration_minutes ? Number(duration_minutes) : undefined,
        questionGroups: parsedGroups,
        extraRequirements: extra_requirements || undefined,
      });

      return res.status(200).json({
        message: "Assignment generated from PDF successfully",
        data: assignment,
      });
    } catch (error) {
      console.error("PDF Import Controller Error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate assignment from PDF";
      return res.status(500).json({ message });
    }
  },
};

export default PdfImportController;

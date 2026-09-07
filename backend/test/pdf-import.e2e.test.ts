import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import PdfImportController from "@/controllers/pdfImport.js";
import PdfExtractorService from "@/services/pdfExtractor.js";
import { extraction_method_t } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

/**
 * E2E TESTS — PdfImportController.import: 1 luồng thực tế từ lúc upload file
 * đến khi AI sinh ra đề kiểm tra từ file đó (mô phỏng request HTTP POST /pdf/import).
 *
 * Chạy thật : validateUploadFiles (giới hạn 5 file / 10MB / mimetype) +
 *             extractPdfContent (fixture PDF thật).
 * Được mock : Gemini (AI) và UploadExamRepository (DB).
 *
 * Phủ các nhánh response:
 *   200 — happy path: text layer, OCR scan, đề thật, nhiều file
 *   400 — không file, > 5 file, file > 10MB, sai mimetype, PDF hỏng, chưa đăng nhập
 *   500 — AI trả JSON không hợp lệ
 */

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir, name));
}

const mockGenerateContent = vi.fn();
const mockSaveRawText = vi.fn();

vi.mock("@/config/gemini.js", () => ({
  default: { models: { generateContent: (...a: unknown[]) => mockGenerateContent(...a) } },
}));

vi.mock("@/repositories/uploaded_exam.repository.js", () => ({
  UploadExamRepository: { saveRawText: (...a: unknown[]) => mockSaveRawText(...a) },
}));

// Response AI "chuẩn" cho mọi happy path
const AI_ASSIGNMENT = {
  title: "Đề kiểm tra Vật lý 11",
  description: "Đề kiểm tra 45 phút",
  class_level: "11",
  duration_minutes: 45,
  subject: "Vật lý",
  questions: [
    {
      content: "Câu 1: Dao động điều hòa là gì?",
      type: "SINGLE_CHOICE",
      answer: "A",
      cognitive_level: "NB",
      answers: [
        { content: "Phương án A", isCorrect: true },
        { content: "Phương án B", isCorrect: false },
      ],
    },
  ],
};

// Dựng Express.Multer.File giả từ tên + buffer (giả lập Multer đã parse xong)
function makeFile(
  originalname: string,
  buffer: Buffer,
  mimetype = "application/pdf"
): Express.Multer.File {
  return {
    originalname,
    buffer,
    mimetype,
    size: buffer.length,
    fieldname: "files",
    encoding: "7bit",
    destination: "",
    filename: originalname,
    path: "",
    stream: undefined as unknown as NodeJS.ReadableStream,
  } as Express.Multer.File;
}

// Returns the arguments of the nth saveRawText call, failing loudly if the
// repository was not invoked (keeps noUncheckedIndexedAccess happy).
function savedCall(index = 0): unknown[] {
  const call = mockSaveRawText.mock.calls[index];
  if (!call) throw new Error(`saveRawText was not called ${index + 1} time(s)`);
  return call;
}

// Response Express giả ghi lại statusCode + body để assert
function createMockRes(): {
  status: (code: number) => ReturnType<typeof vi.fn>;
  json: (body: unknown) => ReturnType<typeof vi.fn>;
  statusCode: number;
  body: unknown;
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as ReturnType<typeof createMockRes>;
}

describe("E2E — PdfImportController.import (upload → extract → save → generate)", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockSaveRawText.mockReset();
    mockSaveRawText.mockResolvedValue({ id: 1 });
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(AI_ASSIGNMENT) });
  });

  // ── Happy path: PDF có text layer ───────────────────────────────────────
  /**
   * Upload text-layer.pdf → HTTP 200, body.data == đề AI sinh ra; đồng thời
   * raw text phải được lưu với ĐỦ 6 trường đúng giá trị (user 42, tên file,
   * dung lượng > 0, mime PDF, method = PDF_TEXT).
   */
  it("should return 200 and save PDF_TEXT raw text for a text-layer PDF", async () => {
    const req = {
      files: [makeFile("text-layer.pdf", readFixture("text-layer.pdf"))],
      user: { id: 42, username: "teacher", role: "TEACHER" },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect((res.body as { message: string }).message).toBe(
      "Assignment generated from PDF successfully"
    );
    expect((res.body as { data: typeof AI_ASSIGNMENT }).data).toEqual(AI_ASSIGNMENT);

    // raw text must have been persisted with PDF_TEXT method
    expect(mockSaveRawText).toHaveBeenCalledTimes(1);
    const [rawText, userId, fileName, fileSize, mimeType, method] = savedCall();
    expect(rawText).toContain("Cau 1");
    expect(userId).toBe(42);
    expect(fileName).toBe("text-layer.pdf");
    expect(fileSize).toBeGreaterThan(0);
    expect(mimeType).toBe("application/pdf");
    expect(method).toBe(extraction_method_t.PDF_TEXT);
  });

  // ── Happy path: PDF không có text layer (scanned → OCR) ────────────────
  /**
   * Upload scanned.pdf (ảnh scan) → HTTP 200; raw text lưu phải có marker OCR
   * "--- Trang 1 ---" và method = OCR.
   * Timeout 60s vì OCR chạy thật.
   */
  it("should return 200 and save OCR raw text for a scanned PDF", async () => {
    const req = {
      files: [makeFile("scanned.pdf", readFixture("scanned.pdf"))],
      user: { id: 1, username: "teacher", role: "TEACHER" },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(mockSaveRawText).toHaveBeenCalledTimes(1);
    const [ocrRawText, , , , , ocrMethod] = savedCall();
    expect(ocrRawText).toContain("--- Trang 1 ---");
    expect(ocrMethod).toBe(extraction_method_t.OCR);
  }, 60_000);

  // ── Happy path: đề thi thật ─────────────────────────────────────────────
  /**
   * Upload đề Hàn Thuyên thật (255 KB) → HTTP 200; method = PDF_TEXT
   * (đề số hóa thật phải đi luồng text layer, không OCR).
   */
  it("should generate an assignment from a real-world exam PDF upload", async () => {
    const req = {
      files: [makeFile("exam-1.pdf", readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf"))],
      user: { id: 2, username: "teacher", role: "TEACHER" },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(mockSaveRawText).toHaveBeenCalledTimes(1);
    expect(savedCall()[5]).toBe(extraction_method_t.PDF_TEXT);
  });

  // ── Happy path: nhiều file cùng lúc (kỹ thuật trộn) ────────────────────
  /**
   * Upload 2 file 1 lần → saveRawText gọi đúng 2 lần (MỖI file 1 lần),
   * method của từng file ghi đúng theo nội dung file đó.
   */
  it("should process multiple uploaded PDFs and save raw text for each", async () => {
    const req = {
      files: [
        makeFile("text-layer.pdf", readFixture("text-layer.pdf")),
        makeFile("exam-1.pdf", readFixture("1. Hàn Thuyên - Bắc Ninh-1.pdf")),
      ],
      user: { id: 3, username: "teacher", role: "TEACHER" },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(200);
    expect(mockSaveRawText).toHaveBeenCalledTimes(2);
    const methods = (
      mockSaveRawText.mock.calls as Array<{
        5?: extraction_method_t;
      }>
    ).map((call) => call[5] ?? extraction_method_t.PDF_TEXT);
    expect(methods).toEqual([
      extraction_method_t.PDF_TEXT,
      extraction_method_t.PDF_TEXT,
    ]);
  });

  // ── Validation: không có file ───────────────────────────────────────────
  /** Upload rỗng → HTTP 400 "Vui lòng tải lên ít nhất 1 file PDF", không đụng DB/AI. */
  it("should return 400 when no files are uploaded", async () => {
    const req = { user: { id: 1 } } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toBe(
      "Vui lòng tải lên ít nhất 1 file PDF"
    );
    expect(mockSaveRawText).not.toHaveBeenCalled();
  });

  // ── Validation: quá 5 file ──────────────────────────────────────────────
  /** 6 file → HTTP 400 "tối đa 5 file PDF" (giới hạn số file của Multer/controller). */
  it("should return 400 when more than 5 files are uploaded", async () => {
    const file = makeFile("a.pdf", readFixture("text-layer.pdf"));
    const req = {
      files: Array(6).fill(file),
      user: { id: 1 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain("tối đa 5 file PDF");
    expect(mockSaveRawText).not.toHaveBeenCalled();
  });

  // ── Validation: file vượt 10MB ──────────────────────────────────────────
  /** Buffer 10MB+1 byte → HTTP 400 "vượt quá giới hạn 10MB" (giới hạn dung lượng). */
  it("should return 400 when a file exceeds 10MB", async () => {
    const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);
    const req = {
      files: [makeFile("huge.pdf", bigBuffer)],
      user: { id: 1 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain("vượt quá giới hạn 10MB");
  });

  // ── Validation: sai mimetype ────────────────────────────────────────────
  /** File text/plain → HTTP 400 "không phải là PDF" (fileFilter không cho qua). */
  it("should return 400 when an uploaded file is not a PDF", async () => {
    const txt = fs.readFileSync(path.join(fixturesDir, "not-a-pdf.txt"));
    const req = {
      files: [makeFile("doc.txt", txt, "text/plain")],
      user: { id: 1 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain("không phải là PDF");
  });

  // ── Lỗi: PDF hỏng không đọc được ────────────────────────────────────────
  /**
   * Upload corrupted.pdf → HTTP 400 "Không thể đọc nội dung file ..." và
   * KHÔNG save raw text (dữ liệu hỏng không được ghi DB).
   */
  it("should return 400 when the PDF cannot be read (corrupted file)", async () => {
    const req = {
      files: [makeFile("broken.pdf", readFixture("corrupted.pdf"))],
      user: { id: 1 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain(
      'Không thể đọc nội dung file "broken.pdf"'
    );
    expect(mockSaveRawText).not.toHaveBeenCalled();
  });

  // ── Lỗi: AI trả JSON không hợp lệ → 500 ─────────────────────────────────
  /**
   * AI trả text không phải JSON sau khi extract thành công → HTTP 500 với
   * message lỗi gốc (lỗi hệ thống, không phải lỗi người dùng).
   */
  it("should return 500 when the AI service returns invalid JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "this is not json" });

    const req = {
      files: [makeFile("text-layer.pdf", readFixture("text-layer.pdf"))],
      user: { id: 1 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(500);
    expect((res.body as { message: string }).message).toBe(
      "Gemini returned invalid JSON"
    );
  });

  // ── Lỗi: chưa đăng nhập ─────────────────────────────────────────────────
  /**
   * Thiếu req.user (route thật được authenticator chặn trước, controller tự
   * bảo vệ thêm) → HTTP 400 với message về đọc file.
   */
  it("should return 400 when the user is not authenticated", async () => {
    const req = {
      files: [makeFile("text-layer.pdf", readFixture("text-layer.pdf"))],
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    expect(res.statusCode).toBe(400);
    expect((res.body as { message: string }).message).toContain(
      'Không thể đọc nội dung file "text-layer.pdf"'
    );
  });

  // ── Kiểm chứng tính toàn vẹn raw text ───────────────────────────────────
  /**
   * Toàn vẹn end-to-end: raw text controller lưu vào DB phải TRÙNG KHỚP 100%
   * với output của extractPdfContent (không biến đổi, không mất ký tự).
   */
  it("should record the same raw text that extractPdfContent produced", async () => {
    const extraction = await PdfExtractorService.extractPdfContent(
      readFixture("text-layer.pdf")
    );

    const req = {
      files: [makeFile("text-layer.pdf", readFixture("text-layer.pdf"))],
      user: { id: 9 },
    } as unknown as Request;
    const res = createMockRes();

    await PdfImportController.import(req, res as unknown as Response);

    const savedRawText = savedCall()[0] as string;
    expect(savedRawText).toBe(extraction.rawText);
    expect(extraction.extractionMethod).toBe(extraction_method_t.PDF_TEXT);
  });
});
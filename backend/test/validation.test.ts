import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  validateBody,
  validateQuery,
  validateParams,
  validatePdfUpload,
} from "@/middlewares/validate.js";
import {
  aiCreateSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  pdfImportFormSchema,
  queryLessonsSchema,
  idParamSchema,
} from "@/schemas/index.js";

// Helper function to create mock Express req, res, next
function createMockContext(overrides: Partial<Request> = {}) {
  let statusCode = 200;
  let jsonResponse: any = null;
  let isNextCalled = false;

  const req = {
    body: {},
    query: {},
    params: {},
    headers: {},
    files: undefined,
    ...overrides,
  } as unknown as Request;

  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      jsonResponse = data;
      return res;
    },
  } as unknown as Response;

  const next: NextFunction = () => {
    isNextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getJsonResponse: () => jsonResponse,
    getIsNextCalled: () => isNextCalled,
  };
}

describe("Request & File Validation Middleware Suite", () => {
  // ==========================================
  // SECTION 1: FILE VALIDATION (VALID-001 .. VALID-006)
  // ==========================================
  describe("File Validation", () => {
    // VALID-001: Valid PDF
    it("VALID-001: should pass validation for valid PDF file with %PDF- header", () => {
      const validPdfBuffer = Buffer.from("%PDF-1.4 sample content for test");
      const mockFile = {
        fieldname: "pdfs",
        originalname: "test.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: validPdfBuffer,
        size: validPdfBuffer.length,
      } as Express.Multer.File;

      const { req, res, next, getIsNextCalled } = createMockContext({
        files: [mockFile] as any,
        body: {},
      });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(true);
    });

    // VALID-002: No PDF
    it("VALID-002: should fail validation when no PDF file is provided", () => {
      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({
          files: [],
        });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toContain("Vui lòng tải lên ít nhất 1 file PDF");
    });

    // VALID-003: Wrong MIME type
    it("VALID-003: should fail validation when file has invalid MIME type", () => {
      const mockFile = {
        fieldname: "pdfs",
        originalname: "image.png",
        encoding: "7bit",
        mimetype: "image/png",
        buffer: Buffer.from("fake image content"),
        size: 100,
      } as Express.Multer.File;

      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({
          files: [mockFile] as any,
        });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toContain("không phải là PDF");
    });

    // VALID-004: Non-PDF file with .pdf extension (Magic bytes check)
    it("VALID-004: should fail validation for spoofed .pdf file with invalid magic bytes", () => {
      const spoofedBuffer = Buffer.from("This is a plain text file renamed to malicious.pdf");
      const mockFile = {
        fieldname: "pdfs",
        originalname: "fake.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: spoofedBuffer,
        size: spoofedBuffer.length,
      } as Express.Multer.File;

      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({
          files: [mockFile] as any,
        });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toContain("Invalid file signature");
    });

    // VALID-005: PDF exceeds maximum size
    it("VALID-005: should fail validation when PDF file size exceeds 10MB limit", () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      oversizedBuffer.write("%PDF-");
      const mockFile = {
        fieldname: "pdfs",
        originalname: "large.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: oversizedBuffer,
        size: oversizedBuffer.length,
      } as Express.Multer.File;

      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({
          files: [mockFile] as any,
        });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toContain("vượt quá giới hạn 10MB");
    });

    // VALID-006: Empty file (0 bytes)
    it("VALID-006: should fail validation when uploaded PDF file is empty (0 bytes)", () => {
      const emptyBuffer = Buffer.alloc(0);
      const mockFile = {
        fieldname: "pdfs",
        originalname: "empty.pdf",
        encoding: "7bit",
        mimetype: "application/pdf",
        buffer: emptyBuffer,
        size: 0,
      } as Express.Multer.File;

      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({
          files: [mockFile] as any,
        });

      validatePdfUpload(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().message).toContain("rỗng (0 bytes)");
    });
  });

  // ==========================================
  // SECTION 2: REQUIRED FIELDS (VALID-007 .. VALID-010)
  // ==========================================
  describe("Required Fields Validation", () => {
    // VALID-007: Missing required field
    it("VALID-007: should reject when required field 'title' is missing", () => {
      const invalidBody = {
        description: "No title provided",
        class_level: "12",
        duration_minutes: 45,
        subject: "Physics",
        questions: [
          {
            content: "Question 1",
            question_type: "SINGLE_CHOICE",
            answers: [{ content: "A", isCorrect: true }],
          },
        ],
      };

      const middleware = validateBody(createAssignmentSchema);
      const { req, res, next, getStatusCode, getJsonResponse, getIsNextCalled } =
        createMockContext({ body: invalidBody });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
      expect(getJsonResponse().errors.some((e: any) => e.field === "title")).toBe(true);
    });

    // VALID-008: Null field
    it("VALID-008: should reject when required field is null", () => {
      const invalidBody = {
        data: {
          class_level: null,
          subject: "Math",
          title: "Math Quiz",
          time_duration: 30,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [1],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-009: Undefined field
    it("VALID-009: should reject when required field is undefined", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: undefined,
          title: "Physics Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [1],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-010: Empty string
    it("VALID-010: should reject when required string field is an empty string", () => {
      const invalidBody = {
        title: "   ", // whitespace only
        description: "Test description",
        class_level: "12",
        duration_minutes: 45,
        subject: "Physics",
        questions: [
          {
            content: "Question 1",
            question_type: "SINGLE_CHOICE",
            answers: [{ content: "A", isCorrect: true }],
          },
        ],
      };

      const middleware = validateBody(createAssignmentSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });
  });

  // ==========================================
  // SECTION 3: DATA TYPES (VALID-011 .. VALID-014)
  // ==========================================
  describe("Data Type Validation", () => {
    // VALID-011: number field receives invalid string
    it("VALID-011: should reject when number field receives non-numeric string", () => {
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        query: { gradeId: "abc", subjectId: "12" },
      });

      const middleware = validateQuery(queryLessonsSchema);
      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-012: number field receives decimal when integer required
    it("VALID-012: should reject decimal numbers for integer fields", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45.5, // float duration
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [1],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-013: array field receives string
    it("VALID-013: should reject when array field receives plain string instead of array", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: "1, 2, 3", // plain string instead of array
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-014: array contains invalid element
    it("VALID-014: should reject when array contains invalid element types", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [1, "invalid_id", 3],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });
  });

  // ==========================================
  // SECTION 4: BUSINESS CONSTRAINTS (VALID-015 .. VALID-019)
  // ==========================================
  describe("Business Constraints Validation", () => {
    // VALID-015: count / numberOfQuestions <= 0
    it("VALID-015: should reject when question count is <= 0", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 0, // invalid count
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [1],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-016: duration_minutes <= 0
    it("VALID-016: should reject when duration_minutes is <= 0", () => {
      const invalidBody = {
        title: "Exam",
        description: "Desc",
        class_level: "12",
        duration_minutes: -10, // negative duration
        subject: "Physics",
        questions: [
          {
            content: "Question 1",
            question_type: "SINGLE_CHOICE",
            answers: [{ content: "A", isCorrect: true }],
          },
        ],
      };

      const middleware = validateBody(createAssignmentSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-017: invalid subject / enum value
    it("VALID-017: should reject invalid enum values for difficulty or question_type", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "SUPER_HARD", // invalid enum
                type: "SINGLE_CHOICE",
                lessonIds: [1],
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-018: empty lessonIds
    it("VALID-018: should reject when lessonIds array is empty", () => {
      const invalidBody = {
        data: {
          class_level: "12",
          subject: "Math",
          title: "Math Test",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 5,
                difficulty: "TH",
                type: "SINGLE_CHOICE",
                lessonIds: [], // empty lessonIds
              },
            ],
          },
        },
      };

      const middleware = validateBody(aiCreateSchema);
      const { req, res, next, getStatusCode, getIsNextCalled } = createMockContext({
        body: invalidBody,
      });

      middleware(req, res, next);
      expect(getIsNextCalled()).toBe(false);
      expect(getStatusCode()).toBe(400);
    });

    // VALID-019: malformed JSON string in multipart body
    it("VALID-019: should reject malformed JSON string in multipart form field question_groups", () => {
      const result = pdfImportFormSchema.safeParse({
        question_groups: "{ malformed json string }",
      });

      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // SECTION 5: HAPPY PATH VALID REQUEST (VALID-020)
  // ==========================================
  describe("Happy Path Validation", () => {
    // VALID-020: Complete valid requests pass validation
    it("VALID-020: should successfully pass validation for complete valid payloads across endpoints", () => {
      // 1. AI Create Valid Payload
      const validAiPayload = {
        data: {
          class_level: "12",
          subject: "Vật Lý",
          title: "Bài thi thử HK1",
          description: "Đề thi thử ôn tập",
          time_duration: 45,
          question_config: {
            groups: [
              {
                count: 10,
                difficulty: "NB",
                type: "SINGLE_CHOICE",
                lessonIds: [101, 102],
              },
            ],
          },
        },
      };

      const {
        req: reqAi,
        res: resAi,
        next: nextAi,
        getIsNextCalled: getNextAi,
      } = createMockContext({ body: validAiPayload });

      validateBody(aiCreateSchema)(reqAi, resAi, nextAi);
      expect(getNextAi()).toBe(true);

      // 2. Create Assignment Valid Payload
      const validAssignmentPayload = {
        title: "Đề thi chính thức",
        description: "Thi HK1",
        class_level: "12",
        duration_minutes: 60,
        subject: "Toán",
        lessonIds: [1, 2],
        questions: [
          {
            content: "Câu 1: 1+1=?",
            question_type: "SINGLE_CHOICE",
            cognitive_level: "NB",
            answers: [
              { content: "2", isCorrect: true },
              { content: "3", isCorrect: false },
            ],
          },
        ],
      };

      const {
        req: reqAss,
        res: resAss,
        next: nextAss,
        getIsNextCalled: getNextAss,
      } = createMockContext({ body: validAssignmentPayload });

      validateBody(createAssignmentSchema)(reqAss, resAss, nextAss);
      expect(getNextAss()).toBe(true);

      // 3. ID Param Valid Payload
      const {
        req: reqParam,
        res: resParam,
        next: nextParam,
        getIsNextCalled: getNextParam,
      } = createMockContext({ params: { id: "42" } as any });

      validateParams(idParamSchema)(reqParam, resParam, nextParam);
      expect(getNextParam()).toBe(true);
      expect((reqParam.params as any).id).toBe(42);
    });
  });
});

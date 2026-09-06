import { describe, it, expect, vi, beforeEach } from "vitest";
import PdfImportService from "@/services/pdfImport.js";
import gemini from "@/config/gemini.js";
//kiểm tra toàn bộ luồng người dùng
const mockGenerateContent = vi.fn();

vi.mock("@/config/gemini.js", () => ({
  default: {
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  },
}));

function validAiResponse(overrides: Record<string, unknown> = {}) {
  return {
    title: "Đề kiểm tra Vật lý 11",
    description: "Đề kiểm tra 15 phút",
    class_level: "11",
    duration_minutes: 15,
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
    ...overrides,
  };
}

describe("PdfImportService — Unit Tests", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("should throw when no files are provided", async () => {
    await expect(PdfImportService.generateFromPdfs({ files: [] })).rejects.toThrow(
      "No PDF files provided"
    );
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("should throw when a file has empty text", async () => {
    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "empty.pdf", text: "" }],
      })
    ).rejects.toThrow('File "empty.pdf" has no extractable text');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("should throw when a file has whitespace-only text", async () => {
    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "blank.pdf", text: "   \n  " }],
      })
    ).rejects.toThrow('File "blank.pdf" has no extractable text');
  });

  it("should throw when Gemini returns invalid JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "This is not JSON at all" });

    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "test.pdf", text: "Cau 1: Noi dung" }],
      })
    ).rejects.toThrow("Gemini returned invalid JSON");
  });

  it("should throw when Gemini returns an empty response", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "test.pdf", text: "Cau 1: Noi dung" }],
      })
    ).rejects.toThrow("Gemini returned an empty response");
  });

  it("should throw when Gemini returns null text", async () => {
    mockGenerateContent.mockResolvedValue({ text: null });

    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "test.pdf", text: "Cau 1: Noi dung" }],
      })
    ).rejects.toThrow("Gemini returned an empty response");
  });

  it("should successfully parse a valid AI response into an assignment", async () => {
    const assignment = validAiResponse();
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify(assignment) });

    const result = await PdfImportService.generateFromPdfs({
      files: [{ originalname: "test.pdf", text: "Cau 1: Noi dung" }],
      title: "Đề kiểm tra Vật lý 11",
      subject: "Vật lý",
      classLevel: "11",
      durationMinutes: 15,
    });

    expect(result).toEqual(assignment);
    expect(result.title).toBe("Đề kiểm tra Vật lý 11");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].type).toBe("SINGLE_CHOICE");
  });

  it("should forward the assignment schema as the response config", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validAiResponse()),
    });

    await PdfImportService.generateFromPdfs({
      files: [{ originalname: "test.pdf", text: "Cau 1" }],
    });

    const [callArgs] = mockGenerateContent.mock.calls[0] as [Record<string, unknown>];
    const config = callArgs.config as Record<string, unknown>;
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseSchema).toBeDefined();
    expect(
      (config.responseSchema as { properties: Record<string, unknown> }).properties
    ).toBeDefined();
  });

  it("should include every source document text in the prompt", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validAiResponse()),
    });

    await PdfImportService.generateFromPdfs({
      files: [
        { originalname: "doc1.pdf", text: "Content of doc 1" },
        { originalname: "doc2.pdf", text: "Content of doc 2" },
      ],
    });

    const [callArgs] = mockGenerateContent.mock.calls[0] as [Record<string, unknown>];
    const prompt = callArgs.contents as string;

    expect(prompt).toContain("doc1.pdf");
    expect(prompt).toContain("Content of doc 1");
    expect(prompt).toContain("doc2.pdf");
    expect(prompt).toContain("Content of doc 2");
    expect(prompt).toContain("SOURCE DOCUMENT 1");
    expect(prompt).toContain("SOURCE DOCUMENT 2");
  });

  it("should include metadata (title, description, subject, class, duration) in the prompt", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validAiResponse()),
    });

    await PdfImportService.generateFromPdfs({
      files: [{ originalname: "doc1.pdf", text: "Content" }],
      title: "Custom Title",
      description: "Custom Description",
      subject: "Toán",
      classLevel: "10",
      durationMinutes: 60,
      extraRequirements: "Không dùng máy tính",
    });

    const [callArgs] = mockGenerateContent.mock.calls[0] as [Record<string, unknown>];
    const prompt = callArgs.contents as string;

    expect(prompt).toContain("Custom Title");
    expect(prompt).toContain("Custom Description");
    expect(prompt).toContain("Toán");
    expect(prompt).toContain("10");
    expect(prompt).toContain("60");
    expect(prompt).toContain("Không dùng máy tính");
  });

  it("should use sensible defaults when metadata is omitted", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validAiResponse()),
    });

    await PdfImportService.generateFromPdfs({
      files: [{ originalname: "doc1.pdf", text: "Content" }],
    });

    const [callArgs] = mockGenerateContent.mock.calls[0] as [Record<string, unknown>];
    const prompt = callArgs.contents as string;

    expect(prompt).toContain("Đề kiểm tra mới");
    expect(prompt).toContain("Đề kiểm tra được tạo dựa trên đề mẫu");
    expect(prompt).toContain("Không có");
  });

  it("should propagate unexpected AI errors", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Network timeout"));

    await expect(
      PdfImportService.generateFromPdfs({
        files: [{ originalname: "test.pdf", text: "Cau 1" }],
      })
    ).rejects.toThrow("Network timeout");
  });
});
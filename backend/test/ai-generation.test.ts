import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure environment variable exists for config initialization
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "mock-gemini-api-key";

import { LessonRepository } from "@/repositories/lesson.repository.js";
import gemini from "@/config/gemini.js";
import AiService from "@/services/ai.js";
import type { AiRequest } from "@/types/ai-service.js";

vi.mock("@/repositories/lesson.repository.js", () => ({
  LessonRepository: {
    findContentsByIds: vi.fn(),
  },
}));

vi.mock("@/config/gemini.js", () => ({
  default: {
    models: {
      generateContent: vi.fn(),
    },
  },
}));

describe("AI Generated Content & Matrix Compliance Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockDemand: AiRequest = {
    data: {
      class_level: "12",
      subject: "Vật lý",
      title: "Đề thi thử HK1 - Vật lý 12",
      description: "Đề kiểm tra chất lượng theo ma trận kiến thức",
      time_duration: 45,
      question_config: {
        groups: [
          {
            topic: "Dao động điều hòa",
            count: 2,
            difficulty: "NB",
            type: "SINGLE_CHOICE",
            lessonIds: [101],
          },
          {
            topic: "Con lắc đơn",
            count: 1,
            difficulty: "VD",
            type: "MULTIPLE_CHOICE",
            lessonIds: [102],
          },
        ],
      },
    },
  };

  const mockLessons = [
    {
      id: 101,
      lesson_number: 1,
      title: "Bài 1: Dao động điều hòa",
      content: "Nội dung bài 1: x = A cos(omega t + phi)",
    },
    {
      id: 102,
      lesson_number: 2,
      title: "Bài 2: Con lắc đơn",
      content: "Nội dung bài 2: T = 2 pi sqrt(l/g)",
    },
  ];

  it("should validate and map generated AI content correctly according to matrix demand", async () => {
    vi.mocked(LessonRepository.findContentsByIds).mockResolvedValue(mockLessons as any);

    const mockAiResponse = {
      title: "Đề thi thử HK1 - Vật lý 12",
      description: "Đề kiểm tra chất lượng theo ma trận kiến thức",
      class_level: "12",
      duration_minutes: 45,
      subject: "Vật lý",
      questions: [
        {
          content: "Phương trình dao động điều hòa có dạng nào sau đây?",
          type: "SINGLE_CHOICE",
          cognitive_level: "NB",
          answers: [
            { content: "x = A cos(omega t + phi)", isCorrect: true },
            { content: "x = A tan(omega t + phi)", isCorrect: false },
          ],
        },
        {
          content: "Chu kỳ dao động của con lắc đơn phụ thuộc vào yếu tố nào?",
          type: "MULTIPLE_CHOICE",
          cognitive_level: "VD",
          answers: [
            { content: "Chiều dài dây treo l", isCorrect: true },
            { content: "Gia tốc trọng trường g", isCorrect: true },
            { content: "Khối lượng vật nặng m", isCorrect: false },
          ],
        },
      ],
    };

    vi.mocked(gemini.models.generateContent).mockResolvedValue({
      text: JSON.stringify(mockAiResponse),
    } as any);

    const result = await AiService.create(mockDemand);

    // Verify basic mapping
    expect(result.title).toBe("Đề thi thử HK1 - Vật lý 12");
    expect(result.duration_minutes).toBe(45);
    expect(result.lessonIds).toEqual([101, 102]);
    expect(result.questions.length).toBe(2);

    // Verify Question 1 properties
    expect(result.questions[0]!.cognitive_level).toBe("NB");
    expect(result.questions[0]!.question_type).toBe("SINGLE_CHOICE");
    expect(result.questions[0]!.answers).toHaveLength(2);
    expect(result.questions[0]!.answers[0]!.isCorrect).toBe(true);

    // Verify Question 2 properties
    expect(result.questions[1]!.cognitive_level).toBe("VD");
    expect(result.questions[1]!.question_type).toBe("MULTIPLE_CHOICE");
    expect(result.questions[1]!.answers.filter((a) => a.isCorrect)).toHaveLength(2);
  });

  it("should normalize cognitive_level fallback when AI returns unexpected string", async () => {
    vi.mocked(LessonRepository.findContentsByIds).mockResolvedValue([mockLessons[0]] as any);

    const mockSingleDemand: AiRequest = {
      data: {
        ...mockDemand.data,
        question_config: {
          groups: [
            {
              count: 1,
              difficulty: "NB",
              type: "SINGLE_CHOICE",
              lessonIds: [101],
            },
          ],
        },
      },
    };

    const mockAiResponse = {
      title: "Test Assignment",
      description: "Test",
      class_level: "12",
      duration_minutes: 45,
      subject: "Vật lý",
      questions: [
        {
          content: "Cau hoi test level fallback",
          type: "SINGLE_CHOICE",
          cognitive_level: "INVALID_LEVEL_XYZ",
          answers: [
            { content: "Dap an A", isCorrect: true },
          ],
        },
      ],
    };

    vi.mocked(gemini.models.generateContent).mockResolvedValue({
      text: JSON.stringify(mockAiResponse),
    } as any);

    const result = await AiService.create(mockSingleDemand);

    // Default fallback in normalizeLevel is "TH"
    expect(result.questions[0]!.cognitive_level).toBe("TH");
  });

  it("should throw error if requested lessons are missing in database", async () => {
    // Only return lesson 101, missing 102
    vi.mocked(LessonRepository.findContentsByIds).mockResolvedValue([mockLessons[0]] as any);

    await expect(AiService.create(mockDemand)).rejects.toThrow("Lessons not found: 102");
  });

  it("should throw error when Gemini API returns empty text response", async () => {
    vi.mocked(LessonRepository.findContentsByIds).mockResolvedValue(mockLessons as any);

    vi.mocked(gemini.models.generateContent).mockResolvedValue({
      text: "",
    } as any);

    await expect(AiService.create(mockDemand)).rejects.toThrow("Gemini returned an empty response");
  });

  it("should ensure every generated question contains non-empty content and valid answers array", async () => {
    vi.mocked(LessonRepository.findContentsByIds).mockResolvedValue(mockLessons as any);

    const mockAiResponse = {
      title: "Đề kiểm tra",
      description: "Test validation",
      class_level: "12",
      duration_minutes: 15,
      subject: "Vật lý",
      questions: [
        {
          content: "Cau 1?",
          type: "SINGLE_CHOICE",
          cognitive_level: "NB",
          answers: [
            { content: "A", isCorrect: true },
            { content: "B", isCorrect: false },
          ],
        },
      ],
    };

    vi.mocked(gemini.models.generateContent).mockResolvedValue({
      text: JSON.stringify(mockAiResponse),
    } as any);

    const result = await AiService.create(mockDemand);

    for (const q of result.questions) {
      expect(q.content.trim().length).toBeGreaterThan(0);
      expect(q.answers.length).toBeGreaterThan(0);
      const hasCorrect = q.answers.some((ans) => ans.isCorrect === true);
      expect(hasCorrect).toBe(true);
    }
  });
});

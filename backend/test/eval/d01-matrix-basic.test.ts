import { describe, it, expect, beforeAll } from "vitest";
import prisma from "@/config/prisma.js";
import AiService from "@/services/ai.js";
import type { AiRequest } from "@/types/ai-service.js";
import { checkIntraExamDuplicate } from "../helpers/eval-utils.js";

describe("Test Case D-01 [Happy Path]: Tạo đề cơ bản từ 1 bài học (5 câu SINGLE_CHOICE, mức NB)", () => {
  let targetLessonId: number;

  beforeAll(async () => {
    // Lấy bài học đầu tiên trong cơ sở dữ liệu làm dữ liệu thực tế
    const lesson = await prisma.lesson.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, title: true, content: true },
    });

    if (!lesson) {
      throw new Error("Không tìm thấy bài học nào trong CSDL để chạy test case D-01");
    }

    targetLessonId = lesson.id;
  });

  it("D-01: Luồng tạo đề AI phải tuân thủ nghiêm ngặt ma trận và không trùng lặp nội bộ", async () => {
    const demand: AiRequest = {
      data: {
        class_level: "12",
        subject: "Vật lí",
        title: "Đề kiểm tra Đánh giá Năng lực - D-01",
        description: "Kiểm tra mức độ Nhận biết chương 1",
        time_duration: 15,
        question_config: {
          groups: [
            {
              topic: "Nhận biết kiến thức cốt lõi",
              count: 5,
              difficulty: "NB",
              type: "SINGLE_CHOICE",
              lessonIds: [targetLessonId],
            },
          ],
        },
      },
    };

    console.log("--> Đang gửi yêu cầu sinh đề D-01 tới AI Service...");
    const startTime = Date.now();
    const result = await AiService.create(demand);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`--> Hoàn thành sinh đề sau ${duration}s với ${result.questions.length} câu hỏi.`);

    // =========================================================================
    // 1. KIỂM THỬ RÀNG BUỘC MA TRẬN & ĐỊNH DẠNG (Matrix & Constraint Checks)
    // =========================================================================

    // 1.1 Kiểm tra thông tin chung của Assignment
    expect(result.title).toBe(demand.data.title);
    expect(result.duration_minutes).toBe(15);
    expect(result.lessonIds).toContain(targetLessonId);

    // 1.2 Số lượng câu hỏi phải đúng tuyệt đối (5 câu)
    expect(result.questions).toHaveLength(5);

    // 1.3 Kiểm tra 100% câu hỏi tuân thủ đúng định dạng và mức độ nhận thức
    result.questions.forEach((q, index) => {
      // Đúng loại câu hỏi SINGLE_CHOICE
      expect(
        q.question_type,
        `Câu ${index + 1} phải có question_type là SINGLE_CHOICE`
      ).toBe("SINGLE_CHOICE");

      // Đúng mức độ nhận thức NB (Nhận biết)
      expect(
        q.cognitive_level,
        `Câu ${index + 1} phải có cognitive_level là NB`
      ).toBe("NB");

      // Nội dung câu hỏi có ý nghĩa, không rỗng
      expect(q.content.trim().length).toBeGreaterThan(10);

      // Đúng 4 lựa chọn (options)
      expect(
        q.answers,
        `Câu ${index + 1} phải có đúng 4 phương án trả lời`
      ).toHaveLength(4);

      // Đúng duy nhất 1 đáp án đúng
      const correctAnswers = q.answers.filter((a) => a.isCorrect === true);
      expect(
        correctAnswers,
        `Câu ${index + 1} phải có duy nhất 1 đáp án đúng (isCorrect = true)`
      ).toHaveLength(1);

      // Các phương án không được rỗng
      q.answers.forEach((ans, ansIdx) => {
        expect(ans.content.trim().length).toBeGreaterThan(0);
      });

      // Các phương án không được trùng lặp nhau
      const uniqueOptions = new Set(q.answers.map((a) => a.content.trim().toLowerCase()));
      expect(
        uniqueOptions.size,
        `Câu ${index + 1} không được có các phương án lựa chọn trùng lặp`
      ).toBe(4);
    });

    // =========================================================================
    // 2. CHỐT CHẶN TRÙNG LẶP NỘI BỘ (Intra-exam Duplicate Check)
    // =========================================================================
    const dupCheck = checkIntraExamDuplicate(result.questions);

    console.log("--------------------------------------------------");
    console.log("KẾT QUẢ INTRA-EXAM DUPLICATE CHECK:");
    console.log(`- Trạng thái đạt chuẩn: ${dupCheck.passed ? "PASSED ✅" : "FAILED ❌"}`);
    console.log(`- Độ tương đồng cao nhất (Max Jaccard 3-gram): ${(dupCheck.maxSimilarity * 100).toFixed(1)}% (Ngưỡng < 80%)`);
    console.log(`- Số cặp câu hỏi trùng lặp: ${dupCheck.duplicatePairs.length}`);
    if (dupCheck.duplicatePairs.length > 0) {
      console.log("- Chi tiết các cặp trùng lặp:", JSON.stringify(dupCheck.duplicatePairs, null, 2));
    }
    console.log("--------------------------------------------------");

    // Tiêu chuẩn trong plan.md: 0 câu trùng lặp (max(Similarity) < 80%)
    expect(dupCheck.passed).toBe(true);
    expect(dupCheck.maxSimilarity).toBeLessThan(0.8);
    expect(dupCheck.duplicatePairs).toHaveLength(0);
  }, 60_000);
});

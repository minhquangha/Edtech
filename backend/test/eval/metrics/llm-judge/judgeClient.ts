// backend/test/eval/metrics/llm-judge/judgeClient.ts

import deepseek from "@/config/deepseek.js";
import gemini from "@/config/gemini.js";
import { cleanJsonString } from "@/services/aiProvider.js";
import { JUDGE_RUBRIC_SYSTEM_PROMPT, buildJudgePrompt } from "./prompts.js";

export interface JudgeScoreResult {
  faithfulness: number;
  cognitive_alignment: number;
  distractor_quality: number;
  isomorphism_variation?: number | undefined;
  scientific_correctness: number;
  overall_passed: boolean;
  modelUsed: string;
  feedback: string;
}

export interface JudgeOptions {
  mode?: "MATRIX" | "PDF";
  thresholds?: {
    faithfulness?: number;
    cognitive_alignment?: number;
    distractor_quality?: number;
    isomorphism_variation?: number;
    scientific_correctness?: number;
  };
}

const DEFAULT_THRESHOLDS = {
  faithfulness: 4.0,
  cognitive_alignment: 4.0,
  distractor_quality: 4.0,
  isomorphism_variation: 4.0,
  scientific_correctness: 4.8,
};

/**
 * Đánh giá chất lượng đề thi thông qua Giám khảo LLM-as-a-Judge.
 * Ưu tiên sử dụng DeepSeek (deepseek-v4-flash-0731), fallback sang Gemini.
 */
export async function evaluateWithLlmJudge(
  sourceContext: string,
  generatedQuestions: Array<any>,
  options: JudgeOptions = {}
): Promise<JudgeScoreResult> {
  const mode = options.mode || "MATRIX";
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const userPrompt = buildJudgePrompt(sourceContext, generatedQuestions, mode);

  let rawJson = "";
  let modelUsed = "";

  // =========================================================================
  // 1. Ưu tiên hàng đầu: DeepSeek (deepseek-v4-flash-0731 qua Qwen Cloud)
  // =========================================================================
  const deepseekModel = process.env.FALLBACK_MODEL || "deepseek-v4-flash-0731";
  try {
    const completion = await deepseek.chat.completions.create({
      model: deepseekModel,
      messages: [
        { role: "system", content: JUDGE_RUBRIC_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Nhiệt độ thấp để điểm số ổn định, khách quan
    });

    const content = completion.choices[0]?.message?.content;
    if (content && content.trim()) {
      rawJson = cleanJsonString(content);
      modelUsed = `DeepSeek (${deepseekModel})`;
    } else {
      throw new Error("DeepSeek returned empty content");
    }
  } catch (deepseekErr: any) {
    console.warn(
      `[LLM Judge] ⚠️ DeepSeek gặp sự cố (${deepseekErr.message}), chuyển sang giám khảo phụ Gemini...`
    );

    // =========================================================================
    // 2. Dự phòng (Fallback): Gemini
    // =========================================================================
    const geminiModel = process.env.MODEL || "gemini-3.6-flash";
    const fullPrompt = `${JUDGE_RUBRIC_SYSTEM_PROMPT}\n\n${userPrompt}`;

    const response = await gemini.models.generateContent({
      model: geminiModel,
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("Gemini Judge returned empty response");
    }

    rawJson = cleanJsonString(response.text);
    modelUsed = `Gemini (${geminiModel})`;
  }

  // Parse điểm số từ JSON
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (parseErr) {
    throw new Error(`Không thể parse kết quả JSON từ Giám khảo LLM: ${rawJson}`);
  }

  const faithfulness = Number(parsed.faithfulness || 0);
  const cognitive_alignment = Number(parsed.cognitive_alignment || 0);
  const distractor_quality = Number(parsed.distractor_quality || 0);
  const scientific_correctness = Number(parsed.scientific_correctness || 0);
  const isomorphism_variation =
    mode === "PDF" && parsed.isomorphism_variation !== undefined
      ? Number(parsed.isomorphism_variation)
      : undefined;

  // Kiểm tra đạt chuẩn theo từng ngưỡng
  let overall_passed =
    faithfulness >= thresholds.faithfulness &&
    cognitive_alignment >= thresholds.cognitive_alignment &&
    distractor_quality >= thresholds.distractor_quality &&
    scientific_correctness >= thresholds.scientific_correctness;

  if (isomorphism_variation !== undefined) {
    overall_passed =
      overall_passed && isomorphism_variation >= thresholds.isomorphism_variation;
  }

  return {
    faithfulness,
    cognitive_alignment,
    distractor_quality,
    isomorphism_variation,
    scientific_correctness,
    overall_passed,
    modelUsed,
    feedback: parsed.feedback || "Không có nhận xét chi tiết",
  };
}

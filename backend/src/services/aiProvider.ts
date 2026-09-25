import gemini from "@/config/gemini.js";
import deepseek from "@/config/deepseek.js";
import { assignmentAiSchema } from "@/types/ai-service.js";

/**
 * Checks if the error is caused by rate limit, quota exhaustion (429), or service overload (503).
 */
export function isQuotaOrOverloadedError(error: any): boolean {
  const msg = (error?.message || "").toLowerCase();
  const status = error?.status || error?.code || error?.response?.status;

  return (
    status === 429 ||
    status === 503 ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable")
  );
}

/**
 * Removes markdown fences like ```json ... ``` if returned by the fallback LLM.
 */
export function cleanJsonString(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Generates assignment content using Gemini as primary provider.
 * Automatically falls back to deepseek-v4-flash-0731 (Qwen Cloud) when Gemini is rate-limited or overloaded.
 */
export async function generateAssignmentContent(prompt: string): Promise<string> {
  const geminiModel = process.env.MODEL || "gemini-3.6-flash";
  const fallbackModel = process.env.FALLBACK_MODEL || "deepseek-v4-flash-0731";

  // ==========================================
  // 1. Primary Attempt: Gemini
  // ==========================================
  try {
    const response = await gemini.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: assignmentAiSchema,
        temperature: 0.35,
      },
    });

    if (response.text) {
      return response.text;
    }
    throw new Error("Gemini returned an empty response");
  } catch (error: any) {
    const shouldFallback = isQuotaOrOverloadedError(error);

    if (!shouldFallback) {
      console.error("[AiProvider] Gemini encountered error:", error.message);
      throw error;
    }

    console.warn(
      `[AiProvider] ⚠️ Gemini rate-limited or overloaded (${error.message}). Falling back to ${fallbackModel}...`
    );
  }

  // ==========================================
  // 2. Secondary Attempt: Qwen Cloud (deepseek-v4-flash-0731)
  // ==========================================
  try {
    const systemPrompt = `You are an AI assistant specialized in creating educational assignments.
You MUST reply strictly in valid JSON matching the following JSON Schema:
${JSON.stringify(assignmentAiSchema, null, 2)}

Do NOT wrap the output in markdown or code blocks. Return only valid raw JSON.`;

    const completion = await deepseek.chat.completions.create({
      model: fallbackModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error(`Fallback model ${fallbackModel} returned empty content`);
    }
    return cleanJsonString(content);
  } catch (fallbackError: unknown) {
    const errorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    console.error(`[AiProvider] Fallback model ${fallbackModel} failed:`, fallbackError);
    throw new Error(
      `Both Gemini and Fallback model (${fallbackModel}) failed: ${errorMsg}`
    );
  }
}

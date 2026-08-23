// src/config/deepseek.ts

import OpenAI from "openai";

const deepseek = new OpenAI({
  apiKey: process.env.QWEN_CLOUD_API_KEY,
  baseURL:
    "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
});

export default deepseek;
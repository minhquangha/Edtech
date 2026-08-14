import { GoogleGenAI } from "@google/genai";


const apiKey =  process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}
const gemini = new GoogleGenAI({
  apiKey: apiKey,
});

export default gemini;
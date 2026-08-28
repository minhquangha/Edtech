import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfExtractorService from "@/services/pdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "fixtures");

describe("Physics symbols extraction check", () => {
  it("inspects physics symbols in Part 1", async () => {
    const filePath = path.join(fixturesDir, "1. Hàn Thuyên - Bắc Ninh-1.pdf");
    const result = await PdfExtractorService.extractPdfContent(fs.readFileSync(filePath));
    
    console.log("=== PHYSICS SYMBOLS IN PART 1 ===");
    console.log("Contains pi symbol ():", result.rawText.includes(""));
    console.log("Contains lambda symbol ():", result.rawText.includes(""));
    console.log("Contains delta symbol ():", result.rawText.includes(""));
    console.log("Contains equals symbol ():", result.rawText.includes(""));
    console.log("Contains units (N / m, Hz, rad, cm):", 
      result.rawText.includes("N / m") &&
      result.rawText.includes("Hz") &&
      result.rawText.includes("rad") &&
      result.rawText.includes("cm")
    );

    const matches = result.rawText.match(/.*(||||N \/ m|Hz|rad|cos|rad).*/g);
    console.log("Found matching lines in Part 1:", matches?.slice(0, 10));
  });

  it("inspects physics symbols in Part 2", async () => {
    const filePath = path.join(fixturesDir, "1. Hàn Thuyên - Bắc Ninh-2.pdf");
    const result = await PdfExtractorService.extractPdfContent(fs.readFileSync(filePath));
    
    console.log("\n=== PHYSICS SYMBOLS IN PART 2 ===");
    console.log("Contains pi symbol ():", result.rawText.includes(""));
    console.log("Contains lambda symbol ():", result.rawText.includes(""));
    console.log("Contains delta symbol ():", result.rawText.includes(""));
    console.log("Contains equals symbol ():", result.rawText.includes(""));

    const matches = result.rawText.match(/.*(||||N \/ m|Hz|rad|cos|cm).*/g);
    console.log("Found matching lines in Part 2:", matches?.slice(0, 10));
  });
});

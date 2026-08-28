import { PDFParse } from "pdf-parse";
import { pdf } from "pdf-to-img";
import Tesseract from "tesseract.js";
import { extraction_method_t } from "@prisma/client";

export interface ExtractionResult {
  rawText: string;
  extractionMethod: extraction_method_t;
}

export function hasMeaningfulText(text: string): boolean {
  if (!text) {
    return false;
  }

  // Loại bỏ các marker/metadata do PDF parser sinh ra
  const cleanedText = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim();

  return cleanedText.length > 0;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: buffer });
  const result = await pdf.getText();

  if (typeof result === "string") {
    return result;
  }

  if (result && typeof result === "object") {
    const r = result as {
      pages?: unknown[];
      text?: string;
    };

    if (typeof r.text === "string") {
      return r.text;
    }

    if (Array.isArray(r.pages)) {
      return r.pages
        .map((page: unknown) => {
          if (typeof page === "string") {
            return page;
          }

          if (page && typeof page === "object" && "text" in page) {
            return String((page as { text: unknown }).text ?? "");
          }

          return "";
        })
        .join("\n\n");
    }
  }

  return "";
}

export async function extractPdfTextUsingOCR(buffer: Buffer): Promise<string> {
  const document = await pdf(buffer, {
    scale: 2,
  });
  let fullText = "";
  let pageNumber = 0;
  for await (const image of document) {
    pageNumber++;

    console.log(`\nĐang OCR trang ${pageNumber}...`);

    const result = await Tesseract.recognize(image, "vie");

    const text = result.data.text;

    console.log(`OCR trang ${pageNumber} hoàn thành`);

    fullText += `--- Trang ${pageNumber} ---\n`;

    fullText += text.trim();

    fullText += "\n\n";
  }
  document.destroy();
  return fullText;
}

export async function extractPdfContent(buffer: Buffer): Promise<ExtractionResult> {
  let text = "";
  let extractionMethod: extraction_method_t = extraction_method_t.PDF_TEXT;
  let useOcr = false;

  try {
    text = await PdfExtractorService.extractPdfText(buffer);
    if (!PdfExtractorService.hasMeaningfulText(text)) {
      useOcr = true;
    }
  } catch (error) {
    console.warn("PDF text extraction failed, falling back to OCR:", error);
    useOcr = true;
  }

  if (useOcr) {
    text = await PdfExtractorService.extractPdfTextUsingOCR(buffer);
    extractionMethod = extraction_method_t.OCR;
  }

  if (!PdfExtractorService.hasMeaningfulText(text)) {
    throw new Error("No extractable text found in PDF using text extraction or OCR");
  }

  return {
    rawText: text,
    extractionMethod,
  };
}

export const PdfExtractorService = {
  hasMeaningfulText,
  extractPdfText,
  extractPdfTextUsingOCR,
  extractPdfContent,
};

export default PdfExtractorService;

import { extraction_method_t } from "@prisma/client";
export interface ExtractionResult {
    rawText: string;
    extractionMethod: extraction_method_t;
}
export declare function hasMeaningfulText(text: string): boolean;
export declare function extractPdfText(buffer: Buffer): Promise<string>;
export declare function extractPdfTextUsingOCR(buffer: Buffer): Promise<string>;
export declare function extractPdfContent(buffer: Buffer): Promise<ExtractionResult>;
export declare const PdfExtractorService: {
    hasMeaningfulText: typeof hasMeaningfulText;
    extractPdfText: typeof extractPdfText;
    extractPdfTextUsingOCR: typeof extractPdfTextUsingOCR;
    extractPdfContent: typeof extractPdfContent;
};
export default PdfExtractorService;
//# sourceMappingURL=pdfExtractor.d.ts.map
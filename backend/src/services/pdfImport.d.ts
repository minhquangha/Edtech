interface PdfFileMeta {
    originalname: string;
    text: string;
}
interface GenerateFromPdfsParams {
    files: PdfFileMeta[];
    title?: string;
    description?: string;
    subject?: string;
    classLevel?: string;
    durationMinutes?: number;
    extraRequirements?: string;
}
declare const PdfImportService: {
    generateFromPdfs: (params: GenerateFromPdfsParams) => Promise<any>;
};
export default PdfImportService;
//# sourceMappingURL=pdfImport.d.ts.map
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../test/fixtures");

if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. PDF with real text layer
const textLayerPdfStream = `BT
/F1 14 Tf
50 700 Td
(Cau 1: De thi kiem tra mau) Tj
0 -30 Td
(A. Phuong an A) Tj
0 -20 Td
(B. Phuong an B) Tj
0 -20 Td
(C. Phuong an C) Tj
0 -20 Td
(D. Phuong an D) Tj
ET`;

const textLayerPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${Buffer.byteLength(textLayerPdfStream)} >>
stream
${textLayerPdfStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000244 00000 n 
0000000450 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
520
%%EOF`;

// 2. Scanned PDF (image object only, no text layer stream)
const scannedPdfStream = `q 200 0 0 200 0 0 cm /Im1 Do Q`;

const scannedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 12 >>
stream
\xff\x00\x00\x00\xff\x00\x00\x00\xff\xff\xff\xff
endstream
endobj
5 0 obj
<< /Length ${Buffer.byteLength(scannedPdfStream)} >>
stream
${scannedPdfStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000235 00000 n 
0000000400 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
480
%%EOF`;

fs.writeFileSync(path.join(fixturesDir, "text-layer.pdf"), Buffer.from(textLayerPdf));
fs.writeFileSync(path.join(fixturesDir, "scanned.pdf"), Buffer.from(scannedPdf));

console.log("Successfully generated test/fixtures/text-layer.pdf and test/fixtures/scanned.pdf");

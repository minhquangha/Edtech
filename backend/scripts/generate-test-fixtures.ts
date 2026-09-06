/**
 * Generates the synthetic PDF fixtures for the PDF extraction test suite.
 *
 * Run standalone: pnpm tsx scripts/generate-test-fixtures.ts
 * Or import:      generateTestFixtures() from vitest global-setup.
 *
 * Existing real-world PDF fixtures are left untouched. This module only
 * creates the synthetic PDFs needed for unit/edge/performance/quality tests.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, "../test/fixtures");

/**
 * Builds a minimal, well-formed single/multi-page PDF with a Helvetica text
 * layer. Each page receives its own content stream. Xref offsets are computed
 * from the actual byte length of the accumulated document so the file is valid
 * for both pdf-parse (pdf.js) and pdf-to-img (pdfjs-dist).
 */
//Tạo một file PDF hợp lệ từ nội dung các trang --> trả về buffer của file PDF dc tạo
function buildPdf(pages: Array<{ content: string }>): Buffer {
  const fontObjNum = 3 + pages.length * 2;

  interface PdfObject {
    body: string;
    stream?: string;
  }

  const objects: PdfObject[] = [];

  // Object 1 — Catalog
  objects.push({ body: "<< /Type /Catalog /Pages 2 0 R >>" });

  // Object 2 — Pages tree
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push({
    body: `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
  });

  // Page objects + content streams
  pages.forEach((page, i) => {
    const contentObjNum = 4 + i * 2;
    objects.push({
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>`,
    });
    objects.push({
      body: `<< /Length ${Buffer.byteLength(page.content, "utf-8")} >>`,
      stream: page.content,
    });
  });

  // Font object
  objects.push({
    body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((obj, index) => {
    const objNum = index + 1;
    offsets[objNum] = Buffer.byteLength(pdf, "utf-8");
    pdf += `${objNum} 0 obj\n`;
    pdf += `${obj.body}\n`;
    if (obj.stream !== undefined) {
      pdf += "stream\n";
      pdf += `${obj.stream}\n`;
      pdf += "endstream\n";
    }
    pdf += "endobj\n";
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Builds a PDF content stream that renders text using relative positioning,
 * matching the pattern used by the existing working fixture (text-layer.pdf).
 * pdf-parse (pdf.js) extracts text from this format correctly.
 */
//Chuyển text bình thường thành các lệnh PDF để hiển thị text này trong PDF .
function pdfTextStream(text: string): string {
  const lines = text.split("\n");
  const lineHeight = 22;
  const parts: string[] = [];

  parts.push("BT");
  parts.push("/F1 12 Tf");

  lines.forEach((line, i) => {
    const escaped = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

    if (i === 0) {
      parts.push(`50 ${700 - i * lineHeight} Td`);
    } else {
      parts.push(`0 -${lineHeight} Td`);
    }
    parts.push(`(${escaped}) Tj`);
  });

  parts.push("ET");
  return parts.join("\n");
}

// 60 questions × 5 lines, chunked into pages of 6 questions (30 lines/page)
// so no line falls outside the visible page area.
//Tạo nội dung cho một đề thi lớn gồm 60 câu hỏi/10 trang
function generateLargeExamPages(): Array<{ content: string }> {
  const questionsPerPage = 6;
  const linesPerQuestion = 5;
  const maxLinesPerPage = 30;

  const pages: Array<{ content: string }> = [];
  let currentLines: string[] = [];

  for (let i = 1; i <= 60; i++) {
    const questionLines = [
      `Cau ${i}: Noi dung cau hoi so ${i} ve vat ly dao dong dieu hoa.`,
      `A. Phuong an A cau ${i}`,
      `B. Phuong an B cau ${i}`,
      `C. Phuong an C cau ${i}`,
      `D. Phuong an D cau ${i}`,
    ];
    currentLines.push(...questionLines);

    if (
      i % questionsPerPage === 0 ||
      currentLines.length + linesPerQuestion > maxLinesPerPage
    ) {
      pages.push({ content: pdfTextStream(currentLines.join("\n")) });
      currentLines = [];
    }
  }

  if (currentLines.length > 0) {
    pages.push({ content: pdfTextStream(currentLines.join("\n")) });
  }

  return pages;
}
//Ghi một file fixture vào thư mục test/fixtures.
function writeFixture(name: string, content: string | Buffer): void {
  fs.writeFileSync(path.join(fixturesDir, name), content);
  console.log(`Generated test/fixtures/${name}`);
}
//Tạo toàn bộ các file PDF giả phục vụ test
export function generateTestFixtures(): void {
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1. empty-page.pdf — valid PDF, page with an empty content stream.
  writeFixture("empty-page.pdf", buildPdf([{ content: "" }]));

  // 2. blank-page.pdf — valid PDF, page with only whitespace content.
  writeFixture("blank-page.pdf", buildPdf([{ content: "BT ET" }]));

  // 3. corrupted.pdf — invalid PDF: header followed by broken body.
  writeFixture(
    "corrupted.pdf",
    Buffer.from(
      "%PDF-1.4\nNOT A VALID PDF BODY WITH BROKEN STRUCTURE\n%%EOF",
      "utf-8"
    )
  );

  // 4. multi-page.pdf — 3 pages, each with distinct text.
  writeFixture(
    "multi-page.pdf",
    buildPdf([
      { content: pdfTextStream("Cau 1: Trang mot - Vat ly") },
      { content: pdfTextStream("Cau 2: Trang hai - Toan hoc") },
      { content: pdfTextStream("Cau 3: Trang ba - Hoa hoc") },
    ])
  );

  // 5. math-formulas.pdf — PDF with math/physics symbols and units.
  writeFixture(
    "math-formulas.pdf",
    buildPdf([
      {
        content: pdfTextStream(
          "Cau 1: pi = 3.14159, lambda = 600 nm, delta = 2 cm\n" +
            "A. 0,5 kg B. 12 N/m C. 50 Hz D. 2.5 rad\n" +
            "Cau 2: x^2 + y^2 = r^2, a < b, F = m.a"
        ),
      },
    ])
  );

  // 6. large-text.pdf — 60 questions of generated text, split across pages.
  writeFixture("large-text.pdf", buildPdf(generateLargeExamPages()));

  // 7. structure-exam.pdf — a well-structured exam used as the source for the
  //    quality evaluation and E2E tests.
  const structureExam = [
    "DE KIEM TRA HOC KY I - MON VAT LY 11",
    "Thoi gian lam bai: 45 phut",
    "",
    "Phan I. Cau hoi trac nghiem",
    "Cau 1: Dao dong dieu hoa la dao dong co li do la ham sin hoac cosin theo thoi gian.",
    "A. Dung B. Sai",
    "Cau 2: Chu ky dao dong cua con lac lo xo phu thuoc vao khoi luong vat nang.",
    "A. Dung B. Sai",
    "",
    "Phan II. Cau hoi tu luan",
    "Cau 3: Viet cong thuc tinh chu ky cua con lac don va giai thich cac dai luong.",
    "Cau 4: Mot con lac lo xo gom vat nang 200g va lo xo do cung 80 N/m. Tinh chu ky dao dong.",
    "",
    "Phan III. Cau hoi lua chon",
    "Cau 5: Don vi cua tan so la gi?",
    "A. Giay (s) B. Hec (Hz) C. Met (m) D. Newton (N)",
    "Cau 6: Khi bieu dien van toc cua vat dao dong dieu hoa, chieu cua vecto van toc?",
    "A. Luon cung chieu chuyen dong B. Luon nguoc chieu chuyen dong",
    "C. Luon huong ve vi tri can bang D. Luon huong ra xa vi tri can bang",
    "Cau 7: Chu ky dao dong rieng cua con lac lo xo?",
    "A. Tang khi khoi luong tang B. Giam khi khoi luong tang",
    "C. Khong phu thuoc khoi luong D. Phu thuoc vao bien do dao dong",
    "Cau 8: Nang luong dao dong cua con lac lo xo ti le voi?",
    "A. Binh phuong bien do B. Bien do",
    "C. Chu ky D. Tan so",
  ].join("\n");
  writeFixture("structure-exam.pdf", buildPdf([{ content: pdfTextStream(structureExam) }]));

  // 8. not-a-pdf.txt — a plain text file masquerading as a PDF.
  writeFixture(
    "not-a-pdf.txt",
    Buffer.from("This is just plain text, definitely not a PDF document.", "utf-8")
  );

  // 9. scanned-empty-page.pdf — PDF with an image but no text.
  const scannedEmptyStream = `q 200 0 0 200 0 0 cm /Im1 Do Q`;
  const scannedEmptyImage = `\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff\xff`;
  const scannedEmptyPdf = `%PDF-1.4
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
${scannedEmptyImage}
endstream
endobj
5 0 obj
<< /Length ${Buffer.byteLength(scannedEmptyStream)} >>
stream
${scannedEmptyStream}
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
  writeFixture("scanned-empty-page.pdf", Buffer.from(scannedEmptyPdf));

  console.log("\nDone. All synthetic fixtures generated.");
}

// CLI entry point: only run when executed directly, not when imported by the
// vitest global-setup (which calls generateTestFixtures conditionally).
//Kiểm tra file này có đang được chạy trực tiếp bằng command line hay không(tức là chạy trực tp pnpm tsx scripts/generate-test-fixtures.ts)
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
//chạy lệnh pnpm tsx scripts/generate-test-fixtures.ts từ command line thì sẽ khởi chạy hàm generateTestFixtures này
if (isDirectRun) {
  generateTestFixtures();
}
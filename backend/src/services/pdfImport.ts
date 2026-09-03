import gemini from "@/config/gemini.js";
import { assignmentAiSchema } from "@/types/ai-service.js";

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

function buildPrompt(params: GenerateFromPdfsParams): string {
  const {
    files,
    title,
    description,
    subject,
    classLevel,
    durationMinutes,
    extraRequirements,
  } = params;

  const sourceDocuments = files
    .map(
      (file, index) => `
========================
SOURCE DOCUMENT ${index + 1}
Filename: ${file.originalname}
========================

${file.text}
`
    )
    .join("\n");

  return `
Bạn là AI chuyên phân tích đề kiểm tra và tạo đề kiểm tra mới.

NHIỆM VỤ:

Dựa DUY NHẤT vào nội dung các đề/tài liệu PDF được cung cấp bên dưới,
hãy:

1. Phân tích cấu trúc của đề gốc.
2. Xác định số lượng câu hỏi.
3. Xác định loại câu hỏi của từng câu.
4. Xác định cách phân bố các loại câu hỏi.
5. Xác định mức độ nhận thức của các câu hỏi:
   - NB: Nhận biết
   - TH: Thông hiểu
   - VD: Vận dụng
6. Xác định các chủ đề/nội dung kiến thức được kiểm tra.
7. Xác định cách xây dựng câu hỏi và phương án trả lời.
8. Sau khi phân tích, hãy tạo MỘT ĐỀ MỚI có cấu trúc tương tự đề gốc.

========================
THÔNG TIN BỔ SUNG
========================

Tiêu đề mong muốn:
${title || "Đề kiểm tra mới"}

Mô tả:
${description || "Đề kiểm tra được tạo dựa trên đề mẫu"}

Lớp:
${classLevel || "Hãy suy luận từ đề gốc nếu có thể"}

Môn:
${subject || "Hãy xác định từ nội dung đề nếu có thể"}

Thời gian:
${durationMinutes || "Giữ tương tự đề gốc nếu có thể xác định"}

Yêu cầu thêm của giáo viên:
${extraRequirements || "Không có"}

========================
NGUYÊN TẮC TẠO ĐỀ
========================

1. Giữ cấu trúc tổng thể tương tự đề gốc.

2. Giữ chính xác số lượng câu hỏi tương đương với đề gốc.

3. Giữ chính xác tỷ lệ/phân bố các loại câu hỏi tương tự đề gốc.

4. Giữ chính xác phân bố mức độ nhận thức tương tự đề gốc.

5. Các câu hỏi mới phải kiểm tra những kiến thức/chủ đề tương ứng
   với đề gốc.

6. Không sao chép nguyên văn câu hỏi từ đề gốc.

7. Không sao chép nguyên văn các phương án trả lời từ đề gốc.

8. Nội dung câu hỏi mới phải phù hợp với kiến thức trong tài liệu nguồn.

9. Mỗi câu hỏi phải có đúng một cognitive_level:
   - NB
   - TH
   - VD

10. SINGLE_CHOICE:
    - Có ít nhất 2 phương án.
    - Chỉ có đúng 1 phương án isCorrect = true.

11. MULTIPLE_CHOICE:
    - Có ít nhất 2 phương án.
    - Có ít nhất 1 phương án isCorrect = true.

12. TRUE_FALSE:
    - Chỉ có 2 phương án:
      "Đúng" và "Sai".
    - answer phải là "true" hoặc "false".

13. SHORT_ANSWER:
    - answers phải là [].
    - answer phải chứa đáp án ngắn.

14. Đảm bảo đáp án phù hợp với nội dung câu hỏi.

15. Không tạo câu hỏi dựa trên kiến thức không xuất hiện
    trong tài liệu nguồn nếu không cần thiết.

16. Không thêm thông tin không có căn cứ từ đề/tài liệu nguồn.

17. Tất cả các công thức toán học, biểu thức lý/hóa, ký hiệu khoa học trong nội dung câu hỏi và các phương án trả lời phải được viết bằng định dạng LaTeX chuẩn (sử dụng \\( ... \\) cho inline formula và \\[ ... \\] cho display math).

========================
ĐỊNH DẠNG OUTPUT
========================

Chỉ trả về JSON.

Không trả về Markdown.

Không sử dụng code block.

Không giải thích.

Không thêm bất kỳ field nào ngoài những field được định nghĩa
trong response schema.

========================
ĐỀ/TÀI LIỆU NGUỒN
========================

${sourceDocuments}

========================
BẮT ĐẦU TẠO ĐỀ
========================
`;
}

function parseAiResponse(responseText: string) {
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
}

const PdfImportService = {
  generateFromPdfs: async (params: GenerateFromPdfsParams) => {
    try {
      if (!params.files || params.files.length === 0) {
        throw new Error("No PDF files provided");
      }

      for (const file of params.files) {
        if (!file.text || !file.text.trim()) {
          throw new Error(
            `File "${file.originalname}" has no extractable text`
          );
        }
      }

      const prompt = buildPrompt(params);

      const response = await gemini.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: assignmentAiSchema,
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response");
      }

      return parseAiResponse(response.text);
    } catch (error) {
      console.error("PDF Import Service error:", error);
      throw error;
    }
  },
};

export default PdfImportService;
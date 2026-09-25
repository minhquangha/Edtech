import { generateAssignmentContent, cleanJsonString } from "@/services/aiProvider.js";
import type { AssignmentRequest } from "@/types/assignments.js";

interface PdfFileMeta {
  originalname: string;
  text: string;
}

export interface GenerateFromPdfsParams {
  files: PdfFileMeta[];
  title?: string | undefined;
  description?: string | undefined;
  subject?: string | undefined;
  classLevel?: string | undefined;
  durationMinutes?: number | undefined;
  extraRequirements?: string | undefined;
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
Bạn là Chuyên gia Khảo thí và Đo lường Giáo dục AI chuyên phân tích đề thi và tạo đề thi tương đương (Isomorphic Exam Generation).

========================
NHIỆM VỤ CHÍNH
========================

Dựa vào nội dung các đề/tài liệu PDF được cung cấp bên dưới, bạn hãy:
1. Phân tích cấu trúc ma trận của đề gốc: số lượng câu hỏi, phân bố loại câu (SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER), mức độ nhận thức (NB, TH, VD), và các chủ đề/dạng bài kiểm tra.
2. TẠO RA MỘT ĐỀ THI MỚI HOÀN TOÀN TƯƠNG ĐƯƠNG (ISOMORPHIC TEST):
   - Có cùng số lượng câu, cùng dạng toán, cùng phân bố độ khó và kiểm tra cùng chuẩn kiến thức kỹ năng với đề gốc.
   - NHƯNG BẮT BUỘC PHẢI THAY ĐỔI 100% SỐ LIỆU VÀ CÁCH DIỄN ĐẠT CÂU HỎI (TUYỆT ĐỐI KHÔNG SAO CHÉP NGUYÊN VĂN BẤT KỲ CÂU NÀO TỪ ĐỀ GỐC).

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

================================================================================
NGUYÊN TẮC CỐT LÕI: TẠO ĐỀ MỚI ĐẲNG CẤU (ISOMORPHISM & NOVELTY VARIATION)
================================================================================

1. NGUYÊN TẮC ĐẲNG CẤU & BẮT BUỘC BIẾN ĐỔI (ISOMORPHISM & NOVELTY):
   - Giữ cấu trúc tổng thể và chính xác số lượng câu hỏi tương đương đề gốc.
   - Giữ chính xác tỷ lệ và phân bố các loại câu hỏi (SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER) tương tự đề gốc.
   - Các câu hỏi mới phải có cùng dạng toán, cùng bản chất khoa học với câu hỏi tương ứng trong đề gốc, NHƯNG PHẢI ĐƯỢC BIẾN ĐỔI SÁNG TẠO:
     + VỚI BÀI TOÁN TÍNH TOÁN (Định lượng):
       * BẮT BUỘC thay đổi toàn bộ các tham số số học đầu vào sang các giá trị số mới, hợp lý và dễ tính (ví dụ: đổi khối lượng, độ cứng, chu kỳ, thể tích, áp suất, nhiệt độ, chiều dài,... sang các con số thực tế khác).
       * Hoặc đảo chiều bài toán: lấy kết quả ở đề gốc làm dữ kiện, và yêu cầu tính ngược lại đại lượng ban đầu.
       * BẮT BUỘC tính toán lại chính xác đáp án đúng và các phương án sai dựa trên số liệu mới. TUYỆT ĐỐI KHÔNG dùng lại các con số từ đề gốc.
     + VỚI CÂU HỎI LÝ THUYẾT / KHÁI NIỆM (Định tính):
       * BẮT BUỘC thay đổi góc độ hỏi, đối tượng khảo sát, hoặc hiện tượng tương đương (ví dụ: đề gốc hỏi điều kiện cực đại giao thoa -> đề mới hỏi điều kiện cực tiểu giao thoa; đề gốc hỏi đặc điểm chất rắn kết tinh -> đề mới hỏi đặc điểm chất rắn vô định hình; đề gốc hỏi đại lượng pha dao động -> đề mới hỏi chu kỳ hoặc tần số góc).
       * Hoặc chuyển đổi góc độ: từ câu hỏi khẳng định sang nhận định đúng/sai, hoặc điền khuyết.
       * Viết lại toàn bộ nội dung câu hỏi và các phương án trả lời bằng câu từ mới.
     + TUYỆT ĐỐI KHÔNG sao chép nguyên văn câu hỏi hoặc phương án trả lời từ đề gốc (độ tương đồng n-gram containment phải < 40%).

2. BẢO TOÀN CHÍNH XÁC MỨC ĐỘ NHẬN THỨC (COGNITIVE LEVEL ALIGNMENT):
   Mỗi câu hỏi mới phải có đúng một cognitive_level thuộc ["NB", "TH", "VD"] và PHẢI BẢO TOÀN ĐÚNG MỨC ĐỘ TƯ DUY CỦA CÂU HỎI TƯƠNG ỨNG TRONG ĐỀ GỐC:
   - Mức NB (Nhận biết):
     + Áp dụng cho: Mọi câu hỏi lý thuyết chỉ yêu cầu học sinh nhớ, nhận diện hoặc tái hiện lại định nghĩa, khái niệm, tên gọi đại lượng, phát biểu định luật, công thức cơ bản hoặc điều kiện xảy ra hiện tượng (ví dụ: điều kiện giao thoa sóng, đặc điểm của sóng cơ, công thức chu kỳ con lắc, đơn vị đo...).
     + BẮT BUỘC PHẢI GÁN NHÃN 'NB' cho tất cả các câu hỏi kiểm tra ghi nhớ định nghĩa lý thuyết, khái niệm hoặc điều kiện hiện tượng.
     + TUYỆT ĐỐI KHÔNG đưa bài toán tính toán biến đổi nhiều bước vào câu NB.
   - Mức TH (Thông hiểu):
     + Áp dụng cho: Câu hỏi thực sự yêu cầu giải thích bản chất hiện tượng ("vì sao", "tại sao"), so sánh phân biệt giữa 2 khái niệm/hiện tượng, đọc và suy luận từ đồ thị, hoặc tính toán đơn giản tối đa 1 bước thay số trực tiếp vào công thức (ví dụ: áp dụng định luật Boyle-Mariotte tìm thể tích khi áp suất tăng).
     + LƯU Ý ĐẶC BIỆT: TUYỆT ĐỐI KHÔNG gán nhãn TH cho các câu hỏi chỉ hỏi định nghĩa, điều kiện hiện tượng hoặc phát biểu lý thuyết sách giáo khoa (những câu đó 100% phải là NB).
     + TUYỆT ĐỐI KHÔNG gán nhãn VD cho câu chỉ thay số 1 bước đơn giản.
   - Mức VD (Vận dụng):
     + Áp dụng cho: Bài toán tính toán tổng hợp đòi hỏi từ 2 bước tính trở lên, ghép nối từ 2 công thức khác nhau, đổi đơn vị phức tạp, hoặc giải quyết tình huống thực tế mới lạ.

3. NGUYÊN TẮC TRUNG THỰC VỚI NGUỒN & CHỐNG LẠC ĐỀ (STRICT FAITHFULNESS):
   - Mọi câu hỏi sinh ra BẮT BUỘC phải nằm trong phạm vi các chủ đề kiến thức đã xuất hiện trong đề/tài liệu gốc.
   - TUYỆT ĐỐI KHÔNG tự ý đưa vào các chủ đề kiến thức ngoài đề gốc (ví dụ: đề gốc chỉ kiểm tra dao động cơ, sóng cơ thì TUYỆT ĐỐI KHÔNG sinh câu hỏi về điện trường, từ trường, quang học hay vật lý hạt nhân). Mọi câu hỏi sinh ra đều phải truy vết được dạng toán tương ứng trong đề gốc.
   - Không bịa đặt thông tin không có căn cứ từ đề/tài liệu nguồn.

4. QUY TẮC PHƯƠNG ÁN NHIỄU (DISTRACTOR QUALITY) - CHUẨN SƯ PHẠM CAO:
   - Các phương án sai (distractors) phải được xây dựng dựa trên các lỗi tư duy và lỗi bấm máy kinh điển của học sinh:
     * Lỗi tính toán: quên đổi đơn vị (cm sang m, g sang kg, độ C sang K), quên khai căn bậc 2, nhầm tỉ lệ nghịch thành tỉ lệ thuận, quên bình phương, sai dấu.
     * Lỗi lý thuyết: nhầm lẫn giữa các khái niệm gần nhau (ví dụ: sóng ngang với sóng dọc, chu kỳ với tần số, quá trình đẳng nhiệt với đẳng tích).
   - Với câu hỏi công thức/đơn vị/đại lượng: Các phương án sai phải có cấu trúc hình thức toán học tương tự đáp án đúng (cùng đơn vị, đảo phân số, sai dấu), TUYỆT ĐỐI KHÔNG đưa ra đơn vị hoặc thuật ngữ xa lạ mà học sinh có thể loại ngay lập tức.
   - TUYỆT ĐỐI KHÔNG tạo phương án hiển nhiên ngô nghê, vô lý, hay quá chênh lệch về độ dài/độ chi tiết so với đáp án đúng.
   - SINGLE_CHOICE chỉ có duy nhất 1 đáp án đúng không tranh cãi.

5. QUY CÁCH DẠNG CÂU HỎI VÀ ĐỊNH DẠNG:
   - SINGLE_CHOICE: Ít nhất 2 phương án, đúng 1 phương án isCorrect = true.
   - MULTIPLE_CHOICE: Ít nhất 2 phương án, ít nhất 1 phương án isCorrect = true.
   - TRUE_FALSE: Đúng 2 phương án ("Đúng" và "Sai"), answer là "true" hoặc "false".
   - SHORT_ANSWER: answers là [], answer chứa đáp án ngắn gọn (ví dụ: "10 L" hoặc "25").
   - Tất cả các công thức toán học, biểu thức lý/hóa, ký hiệu khoa học trong nội dung câu hỏi và các phương án trả lời phải được viết bằng định dạng LaTeX chuẩn (sử dụng \\( ... \\) cho inline formula và \\[ ... \\] cho display math).

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
    const cleaned = cleanJsonString(responseText);
    return JSON.parse(cleaned);
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

      const jsonText = await generateAssignmentContent(prompt);
      const raw = parseAiResponse(jsonText);

      const normalized: AssignmentRequest = {
        title: raw.title || params.title || "Đề kiểm tra",
        description: raw.description || params.description || "",
        class_level: String(raw.class_level || params.classLevel || "12"),
        duration_minutes: Number(raw.duration_minutes || params.durationMinutes || 45),
        subject: raw.subject || params.subject || "Vật lí",
        questions: (raw.questions || []).map((q: any) => ({
          content: q.content,
          question_type: q.question_type || q.type || "SINGLE_CHOICE",
          ...(q.answer ? { answer: q.answer } : {}),
          cognitive_level: q.cognitive_level || "TH",
          answers: (q.answers || []).map((a: any) => ({
            content: a.content,
            isCorrect: Boolean(a.isCorrect),
          })),
        })),
      };

      return normalized;
    } catch (error) {
      console.error("PDF Import Service error:", error);
      throw error;
    }
  },
};

export default PdfImportService;
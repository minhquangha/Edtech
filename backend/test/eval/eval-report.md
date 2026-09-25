# BÁO CÁO ĐÁNH GIÁ ĐỊNH LƯỢNG HỆ THỐNG AI (EDTECH)
## Tổng quan Kết quả Thực nghiệm

- **Thời gian thực hiện:** 13:47:55 25/9/2026
- **Tổng số kịch bản thử nghiệm:** 20 test cases (10 Tính năng 1, 10 Tính năng 2).
- **Số test case đạt chuẩn:** **20/20** (**100.0%**).
- **Mô hình AI sinh đề:** Gemini-3.6-flash (Fallback: DeepSeek-v4-flash-0731).
- **Mô hình Giám khảo LLM-as-a-Judge:** **DeepSeek-v4-flash-0731 (Ưu tiên)** / Gemini.

---

### Bảng 1: Kết quả Đánh giá Tính năng 1 (Tạo đề theo ma trận bài học)

| Mã | Loại | Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |
|---|---|---|---|---|---|
| D-01 | Happy Path | 1 bài học, 5 câu SINGLE_CHOICE, mức Nhận biết | Đạt chuẩn<br>Max Sim: **16.7%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-02 | Happy Path | 10 câu, tỷ lệ 4 NB – 4 TH – 2 VD | Đạt chuẩn<br>Max Sim: **20.8%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-03 | Happy Path | Ghép 2 bài học, 10 câu | Đạt chuẩn<br>Max Sim: **7.1%** (< 80%) | Faith: **5**/5<br>Align: **4.5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-04 | Happy Path | 4 câu TRUE_FALSE | Đạt chuẩn<br>Max Sim: **12.8%** (< 80%) | N/A | **PASSED** ✅ |
| D-05 | Happy Path | 3 câu SHORT_ANSWER dạng tính toán | Đạt chuẩn<br>Max Sim: **10.5%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-06 | Happy Path | Đề kết hợp 3 dạng (Single Choice + True/False + Short) | Đạt chuẩn<br>Max Sim: **21.7%** (< 80%) | N/A | **PASSED** ✅ |
| D-07 | Edge Case | Chỉ yêu cầu đúng 1 câu Vận dụng | Đạt chuẩn<br>Max Sim: **0.0%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-08 | Edge Case | 100% câu hỏi ở mức Vận dụng | Đạt chuẩn<br>Max Sim: **9.8%** (< 80%) | Faith: **4.5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-09 | Edge Case | Bài học rút gọn chỉ có 2 dòng văn bản; yêu cầu sinh 10 câu | Đạt chuẩn<br>Max Sim: **77.8%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-10 | Edge Case | Nhiều công thức LaTeX phức tạp: Δt, V1/T1, °C | Đạt chuẩn<br>Max Sim: **12.5%** (< 80%) | Faith: **4.5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |

---

### Bảng 2: Kết quả Đánh giá Tính năng 2 (Tạo đề tương đương từ PDF)

| Mã | Loại | File / Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |
|---|---|---|---|---|---|
| P-01 | Happy Path | text-layer.pdf, 1 trang trắc nghiệm chuẩn | Đạt chuẩn<br>Max Sim: **0.0%** | Isomorph: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| P-02 | Happy Path | Hàn Thuyên.pdf, đề thi thực tế THPT | Đạt chuẩn<br>Max Sim: **28.9%** | Isomorph: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| P-03 | Happy Path | multi-page.pdf, đề 3 trang | Đạt chuẩn<br>Max Sim: **13.2%** | N/A | **PASSED** ✅ |
| P-04 | Happy Path | math-formulas.pdf, nhiều công thức Toán/Lý | Đạt chuẩn<br>Max Sim: **0.0%** | N/A | **PASSED** ✅ |
| P-05 | Happy Path | Kèm yêu cầu bổ sung câu hỏi ứng dụng thực tế | Đạt chuẩn<br>Max Sim: **0.0%** | Isomorph: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| P-06 | Happy Path | structure-exam.pdf, Trắc nghiệm + Tự luận | Đạt chuẩn<br>Max Sim: **42.1%** | N/A | **PASSED** ✅ |
| P-07 | Edge Case | File scanned ảnh: Chạy OCR Tesseract và đo chỉ số CER | Đạt chuẩn<br>CER: **2.59%** (≤ 15.0%)<br>Max Sim: **0.0%** | Isomorph: **4.5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| P-08 | Edge Case | empty-page.pdf, trang PDF trắng không có text | Đạt chuẩn | N/A | **PASSED** ✅ |
| P-09 | Edge Case | Đề gốc có đầy đủ câu hỏi và đáp án | Đạt chuẩn<br>Max Sim: **0.0%** | N/A | **PASSED** ✅ |
| P-10 | Edge Case | Đề thi thực tế dài nhiều câu (Hàn Thuyên) | Đạt chuẩn<br>Max Sim: **18.8%** | N/A | **PASSED** ✅ |

---

### Tiêu chí Đánh giá và Chốt chặn An toàn

1. **Chốt chặn OCR (P-07):** $CER = \frac{S+D+I}{N} \le 15.0\%$. Ngăn chặn hoàn toàn dữ liệu rác.
2. **Kiểm tra trùng lặp nội bộ:** Jaccard 3-gram pairwise $max(Similarity) < 80\%$, tỷ lệ trùng $0\%$.
3. **Giám khảo LLM-as-a-Judge:** Chấm độc lập qua mô hình DeepSeek với Rubric sư phạm 5 tiêu chí.

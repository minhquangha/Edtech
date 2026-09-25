# BÁO CÁO ĐÁNH GIÁ ĐỊNH LƯỢNG HỆ THỐNG AI (EDTECH)
## Tổng quan Kết quả Thực nghiệm

- **Thời gian thực hiện:** 16:06:25 22/9/2026
- **Tổng số kịch bản thử nghiệm:** 10 test cases (10 Tính năng 1, 10 Tính năng 2).
- **Số test case đạt chuẩn:** **7/10** (**70.0%**).
- **Mô hình AI sinh đề:** Gemini-3.6-flash (Fallback: DeepSeek-v4-flash-0731).
- **Mô hình Giám khảo LLM-as-a-Judge:** **DeepSeek-v4-flash-0731 (Ưu tiên)** / Gemini.

---

### Bảng 1: Kết quả Đánh giá Tính năng 1 (Tạo đề theo ma trận bài học)

| Mã | Loại | Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |
|---|---|---|---|---|---|
| D-01 | Happy Path | 1 bài học, 5 câu SINGLE_CHOICE, mức Nhận biết | Đạt chuẩn<br>Max Sim: **23.1%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-02 | Happy Path | 10 câu, tỷ lệ 4 NB – 4 TH – 2 VD | Đạt chuẩn<br>Max Sim: **9.1%** (< 80%) | Faith: **4.5**/5<br>Align: **4.5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-03 | Happy Path | Ghép 2 bài học, 10 câu | Đạt chuẩn<br>Max Sim: **14.0%** (< 80%) | Faith: **5**/5<br>Align: **3**/5<br>Sci: **5**/5 | **FAILED** ❌ |
| D-04 | Happy Path | 4 câu TRUE_FALSE | Đạt chuẩn<br>Max Sim: **2.9%** (< 80%) | N/A | **PASSED** ✅ |
| D-05 | Happy Path | 3 câu SHORT_ANSWER dạng tính toán | Đạt chuẩn<br>Max Sim: **7.4%** (< 80%) | Faith: **5**/5<br>Align: **3**/5<br>Sci: **5**/5 | **FAILED** ❌ |
| D-06 | Happy Path | Đề kết hợp 3 dạng (Single Choice + True/False + Short) | Đạt chuẩn<br>Max Sim: **4.0%** (< 80%) | N/A | **PASSED** ✅ |
| D-07 | Edge Case | Chỉ yêu cầu đúng 1 câu Vận dụng | Đạt chuẩn<br>Max Sim: **0.0%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-08 | Edge Case | 100% câu hỏi ở mức Vận dụng | Đạt chuẩn<br>Max Sim: **10.2%** (< 80%) | Faith: **5**/5<br>Align: **4.5**/5<br>Sci: **5**/5 | **PASSED** ✅ |
| D-09 | Edge Case | Bài học rút gọn chỉ có 2 dòng văn bản; yêu cầu sinh 10 câu | Đạt chuẩn<br>Max Sim: **63.6%** (< 80%) | Faith: **5**/5<br>Align: **5**/5<br>Sci: **4.8**/5 | **PASSED** ✅ |
| D-10 | Edge Case | Nhiều công thức LaTeX phức tạp: Δt, V1/T1, °C | Lỗi: [Q3] Tồn tại các phương án có nội dung trùng lặp<br>Max Sim: **5.8%** (< 80%) | Faith: **5**/5<br>Align: **4**/5<br>Sci: **5**/5 | **FAILED** ❌ |

---

### Bảng 2: Kết quả Đánh giá Tính năng 2 (Tạo đề tương đương từ PDF)

| Mã | Loại | File / Kịch bản thử nghiệm | Tầng 1 (Code-based) | Tầng 2 (DeepSeek Judge) | Kết quả |
|---|---|---|---|---|---|

---

### Tiêu chí Đánh giá và Chốt chặn An toàn

1. **Chốt chặn OCR (P-07):** $CER = \frac{S+D+I}{N} \le 15.0\%$. Ngăn chặn hoàn toàn dữ liệu rác.
2. **Kiểm tra trùng lặp nội bộ:** Jaccard 3-gram pairwise $max(Similarity) < 80\%$, tỷ lệ trùng $0\%$.
3. **Giám khảo LLM-as-a-Judge:** Chấm độc lập qua mô hình DeepSeek với Rubric sư phạm 5 tiêu chí.

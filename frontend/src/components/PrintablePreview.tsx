import React from "react";
import type { Assignment, QuestionType } from "../types";

interface PrintablePreviewProps {
  assignment: Assignment | (Omit<Assignment, "id" | "teacher_id"> & { id?: number; teacher_id?: number });
  showAnswers: boolean;
  onClose: () => void;
}

const formatClassLevel = (val: any): string => {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
};

const getQuestionTypeShort = (type: QuestionType): string => {
  switch (type) {
    case "SINGLE_CHOICE": return "Chọn 1 đáp án";
    case "MULTIPLE_CHOICE": return "Chọn nhiều đáp án";
    case "TRUE_FALSE": return "Đúng / Sai";
    case "SHORT_ANSWER": return "Tự luận ngắn";
    default: return type;
  }
};

export const PrintablePreview: React.FC<PrintablePreviewProps> = ({
  assignment,
  showAnswers,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const questions = assignment.questions || [];

  return (
    <>
      {/* ── On-screen modal overlay (hidden when printing) ── */}
      <div className="modal-backdrop print-hide">
        <div className="modal-container modal-large print-preview-modal">
          <div className="modal-header">
            <div className="modal-title-group">
              <h3>
                {showAnswers ? "📋 Xem trước đề + đáp án" : "📋 Xem trước đề thi"}
              </h3>
              <p className="modal-subtitle">
                {showAnswers
                  ? "Bản xem trước kèm đáp án — in ra để giáo viên chấm"
                  : "Bản xem trước đề thi — in ra cho học sinh làm bài"}
              </p>
            </div>
            <button className="btn-close" onClick={onClose} aria-label="Đóng">✕</button>
          </div>

          <div className="modal-body" style={{ background: "#e9eef5", padding: "1.5rem" }}>
            {/* ── Paper preview (A4 ratio) ── */}
            <div className="print-paper">
              {/* Header */}
              <div className="print-header">
                <div className="print-header-left">
                  <div className="print-school">TRƯỜNG THPT EDTECH</div>
                  <div className="print-subject">{assignment.subject || "Môn học"}</div>
                </div>
                <div className="print-header-right">
                  <div className="print-title">{assignment.title || "Bài kiểm tra"}</div>
                  <div className="print-meta">
                    {formatClassLevel(assignment.class_level)} · Thời gian: {assignment.duration_minutes} phút
                  </div>
                </div>
              </div>

              <div className="print-divider" />

              {/* Student info line */}
              <div className="print-student-info">
                <span><strong>Họ và tên:</strong> ______________________</span>
                <span><strong>Lớp:</strong> ____________</span>
                <span><strong>Ngày:</strong> ____/____/______</span>
              </div>

              {assignment.description && (
                <div className="print-description">{assignment.description}</div>
              )}

              {/* Questions */}
              <div className="print-questions">
                {questions.map((q, qIdx) => {
                  const qType = q.question_type || "SINGLE_CHOICE";
                  const answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";

                  return (
                    <div key={q.id || qIdx} className="print-question">
                      <div className="print-question-head">
                        <span className="print-q-number">Câu {qIdx + 1}</span>
                        <span className="print-q-type">({getQuestionTypeShort(qType)})</span>
                      </div>
                      <div className="print-q-content">{q.content}</div>

                      {/* Choice questions */}
                      {(qType === "SINGLE_CHOICE" || qType === "MULTIPLE_CHOICE") && (
                        <div className="print-answers">
                          {(q.answers || []).map((ans, aIdx) => (
                            <div
                              key={ans.id || aIdx}
                              className={`print-answer ${showAnswers && ans.isCorrect ? "print-answer-correct" : ""}`}
                            >
                              <span className="print-answer-letter">{String.fromCharCode(65 + aIdx)}</span>
                              <span className="print-answer-content">{ans.content}</span>
                              {showAnswers && ans.isCorrect && <span className="print-correct-mark">✓</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* True/False */}
                      {qType === "TRUE_FALSE" && (
                        <div className="print-answers print-tf">
                          <div className={`print-tf-option ${showAnswers && answerVal === "true" ? "print-answer-correct" : ""}`}>
                            <span className="print-answer-letter">A</span>
                            <span>Đúng</span>
                            {showAnswers && answerVal === "true" && <span className="print-correct-mark">✓</span>}
                          </div>
                          <div className={`print-tf-option ${showAnswers && answerVal === "false" ? "print-answer-correct" : ""}`}>
                            <span className="print-answer-letter">B</span>
                            <span>Sai</span>
                            {showAnswers && answerVal === "false" && <span className="print-correct-mark">✓</span>}
                          </div>
                        </div>
                      )}

                      {/* Short answer */}
                      {qType === "SHORT_ANSWER" && (
                        <div className="print-short-answer">
                          {showAnswers ? (
                            <div className="print-sa-answer">
                              <span className="print-sa-label">Đáp án:</span>
                              <strong>{answerVal || "Chưa có"}</strong>
                            </div>
                          ) : (
                            <div className="print-sa-blank">..............................................................</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="print-footer-note">
                ── Hết ──
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handlePrint}
              title="In hoặc lưu thành PDF"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              In / Lưu PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Print-only document (visible only during printing) ── */}
      <div className="print-only">
        <div className="print-doc">
          {/* Header */}
          <div className="print-doc-header">
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "12pt", fontWeight: "700" }}>TRƯỜNG THPT EDTECH</div>
              <div style={{ fontSize: "11pt" }}>{assignment.subject || "Môn học"}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "14pt", fontWeight: "700", textTransform: "uppercase" }}>
                {assignment.title || "Bài kiểm tra"}
              </div>
              <div style={{ fontSize: "10pt" }}>
                {formatClassLevel(assignment.class_level)} · Thời gian: {assignment.duration_minutes} phút
              </div>
            </div>
          </div>

          <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #000", margin: "8px 0 16px" }} />

          {/* Student info */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "10pt" }}>
            <span><strong>Họ và tên:</strong> ______________________</span>
            <span><strong>Lớp:</strong> ____________</span>
          </div>

          {assignment.description && (
            <div style={{ marginBottom: "16px", fontSize: "10pt", fontStyle: "italic" }}>
              {assignment.description}
            </div>
          )}

          {/* Questions */}
          {questions.map((q, qIdx) => {
            const qType = q.question_type || "SINGLE_CHOICE";
            const answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";

            return (
              <div key={q.id || qIdx} style={{ marginBottom: "14px" }}>
                <div style={{ fontWeight: "700", marginBottom: "4px" }}>
                  Câu {qIdx + 1}. {q.content}
                  {showAnswers && <span style={{ fontWeight: "400", fontSize: "9pt", color: "#666" }}> ({getQuestionTypeShort(qType)})</span>}
                </div>

                {/* Choice */}
                {(qType === "SINGLE_CHOICE" || qType === "MULTIPLE_CHOICE") && (
                  <div style={{ paddingLeft: "20px" }}>
                    {(q.answers || []).map((ans, aIdx) => (
                      <div key={ans.id || aIdx} style={{ marginBottom: "2px", fontSize: "10pt" }}>
                        <span style={{ fontWeight: "700" }}>{String.fromCharCode(65 + aIdx)}.</span> {ans.content}
                        {showAnswers && ans.isCorrect && <span style={{ fontWeight: "700", color: "#166534" }}> ✓</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* T/F */}
                {qType === "TRUE_FALSE" && (
                  <div style={{ paddingLeft: "20px", fontSize: "10pt" }}>
                    <div><span style={{ fontWeight: "700" }}>A.</span> Đúng{showAnswers && answerVal === "true" ? " ✓" : ""}</div>
                    <div><span style={{ fontWeight: "700" }}>B.</span> Sai{showAnswers && answerVal === "false" ? " ✓" : ""}</div>
                  </div>
                )}

                {/* Short answer */}
                {qType === "SHORT_ANSWER" && (
                  <div style={{ paddingLeft: "20px", fontSize: "10pt" }}>
                    {showAnswers ? (
                      <div><strong>Đáp án:</strong> {answerVal || "Chưa có"}</div>
                    ) : (
                      <div>..............................................................</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ textAlign: "center", marginTop: "20px", fontWeight: "700" }}>── Hết ──</div>
        </div>
      </div>
    </>
  );
};

import React, { useState, useRef, useCallback, useEffect } from "react";
import type {
  AssignmentRequest,
  QuestionType,
  CognitiveLevel,
  RawQuestionResponse,
  EditableQuestion,
  QuestionRequest
} from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { PrintablePreview } from "./PrintablePreview";
import { MathText } from "./MathText";

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignment?: AssignmentRequest) => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const LOADING_STAGES = [
  "Đang đọc đề mẫu PDF...",
  "Đang phân tích cấu trúc & ma trận...",
  "Gemini AI đang tạo đề thi mới...",
  "Đang kiểm tra & tổng hợp kết quả..."
];

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Một đáp án",
  MULTIPLE_CHOICE: "Nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
};

const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  NB: "Nhận biết",
  TH: "Thông hiểu",
  VD: "Vận dụng",
};

const getQuestionTypeBadgeClass = (type: QuestionType): string => {
  switch (type) {
    case "SINGLE_CHOICE": return "type-single";
    case "MULTIPLE_CHOICE": return "type-multi";
    case "TRUE_FALSE": return "type-tf";
    case "SHORT_ANSWER": return "type-sa";
    default: return "type-single";
  }
};

const formatClassLevel = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "Lớp --";
  const str = String(val).trim();
  if (!str) return "Lớp --";
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
};

export const ImportPdfModal: React.FC<ImportPdfModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review step state
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [generatedAssignment, setGeneratedAssignment] = useState<AssignmentRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableQuestions, setEditableQuestions] = useState<EditableQuestion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printShowAnswers, setPrintShowAnswers] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading stage cycling animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isGenerating) {
      setLoadingStage(0);
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % LOADING_STAGES.length);
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  const resetState = useCallback(() => {
    setFiles([]);
    setErrorMsg(null);
    setStep("upload");
    setGeneratedAssignment(null);
    setIsEditing(false);
    setEditableQuestions([]);
    setIsGenerating(false);
    setIsSaving(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validateAndAddFiles = (incoming: File[]) => {
    setErrorMsg(null);
    const pdfFiles = incoming.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length !== incoming.length) {
      setErrorMsg("Chỉ chấp nhận file PDF.");
      return;
    }
    for (const f of pdfFiles) {
      if (f.size > MAX_FILE_SIZE) {
        setErrorMsg(`File "${f.name}" vượt quá giới hạn 10MB.`);
        return;
      }
    }
    setFiles((prev) => {
      const combined = [...prev, ...pdfFiles];
      if (combined.length > MAX_FILES) {
        setErrorMsg(`Chỉ được tải lên tối đa ${MAX_FILES} file PDF.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) validateAndAddFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndAddFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Submit PDF files to Backend AI Generator
  const handleGenerate = async () => {
    if (files.length === 0) {
      setErrorMsg("Vui lòng tải lên ít nhất một file PDF.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // Send FormData with pdfs to backend without old config fields
      const result = await api.importPdfsAndGenerate(files);
      const rawData = result.data;

      const normalizedQuestions: QuestionRequest[] = (rawData.questions || []).map((q: RawQuestionResponse) => {
        const qType: QuestionType = q.question_type || q.type || "SINGLE_CHOICE";
        let answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";
        if (qType === "TRUE_FALSE" && answerVal !== "true" && answerVal !== "false") {
          const correctAns = (q.answers || []).find((a) => a.isCorrect);
          if (correctAns) {
            answerVal = /đúng|true|1/i.test(String(correctAns.content || "")) ? "true" : "false";
          } else {
            answerVal = "true";
          }
        }
        return {
          content: q.content || "",
          question_type: qType,
          cognitive_level: q.cognitive_level || "TH",
          answer: answerVal,
          answers: (q.answers || []).map((a) => ({
            content: a.content || "",
            isCorrect: Boolean(a.isCorrect),
          })),
        };
      });

      const fullAssignment: AssignmentRequest = {
        title: rawData.title || "Bài kiểm tra từ PDF mẫu",
        description: rawData.description || "Bài kiểm tra được tạo tự động bởi AI từ cấu trúc đề mẫu",
        class_level: rawData.class_level || "12",
        subject: rawData.subject || "Tổng hợp",
        duration_minutes: rawData.duration_minutes || 45,
        questions: normalizedQuestions,
      };

      setGeneratedAssignment(fullAssignment);
      setEditableQuestions(
        normalizedQuestions.map((q) => ({
          content: q.content,
          question_type: q.question_type,
          cognitive_level: q.cognitive_level,
          answer: q.answer,
          answers: (q.answers || []).map((a) => ({ content: a.content, isCorrect: a.isCorrect })),
        }))
      );
      setStep("review");
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (/text/i.test(msg) || /read/i.test(msg) || /scan/i.test(msg)) {
        setErrorMsg("Không thể đọc nội dung file PDF. File có thể là PDF scan hoặc không chứa text layer.");
      } else {
        setErrorMsg("Không thể tạo đề từ tài liệu này. Vui lòng thử lại!");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Save generated assignment directly to CSDL
  const handleSaveAssignment = async () => {
    if (!generatedAssignment || !token) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const assignmentToSave: AssignmentRequest = {
        ...generatedAssignment,
        questions: editableQuestions.map((q): QuestionRequest => {
          const qType: QuestionType = q.question_type || "SINGLE_CHOICE";
          if (qType === "TRUE_FALSE") {
            return { content: q.content, question_type: qType, answer: q.answer || "true", answers: [], cognitive_level: q.cognitive_level };
          }
          if (qType === "SHORT_ANSWER") {
            return { content: q.content, question_type: qType, answer: q.answer ? q.answer.trim() : "", answers: [], cognitive_level: q.cognitive_level };
          }
          return {
            content: q.content,
            question_type: qType,
            answers: (q.answers || []).map((a) => ({ content: a.content, isCorrect: Boolean(a.isCorrect) })),
            cognitive_level: q.cognitive_level,
          };
        }),
      };

      await api.createAssignment(assignmentToSave, token);
      onSuccess(assignmentToSave);
      handleClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Không thể lưu bài tập vào cơ sở dữ liệu.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Question type & level summaries for Review step
  const typeCounts = (editableQuestions || []).reduce<Record<QuestionType, number>>(
    (acc, q) => {
      acc[q.question_type] = (acc[q.question_type] || 0) + 1;
      return acc;
    },
    { SINGLE_CHOICE: 0, MULTIPLE_CHOICE: 0, TRUE_FALSE: 0, SHORT_ANSWER: 0 }
  );

  const levelCounts = (editableQuestions || []).reduce<Record<CognitiveLevel, number>>(
    (acc, q) => {
      const lvl = q.cognitive_level === "NB" || q.cognitive_level === "TH" || q.cognitive_level === "VD" ? q.cognitive_level : "TH";
      acc[lvl] += 1;
      return acc;
    },
    { NB: 0, TH: 0, VD: 0 }
  );

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-large">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>
              <span className="sparkle-icon">📄</span>
              {step === "upload" ? "Tạo bài tập từ đề PDF mẫu" : "Review & Chỉnh Sửa Đề Thi AI"}
            </h3>
            <p className="modal-subtitle">
              {step === "upload"
                ? "Tải lên đề thi mẫu, Gemini AI sẽ tự động phân tích ma trận và sinh bài kiểm tra tương tự."
                : "Kiểm tra lại ma trận đề thi và nội dung câu hỏi trước khi bấm Xác nhận & Lưu"}
            </p>
          </div>
          <button className="btn-close" onClick={handleClose} disabled={isGenerating || isSaving} aria-label="Đóng">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error margin-horizontal" style={{ marginTop: "1rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD AREA */}
        {step === "upload" && (
          <div className="modal-body">
            {isGenerating ? (
              <div className="pdf-loading-box">
                <span className="spinner spinner-large"></span>
                <div className="pdf-loading-stage-text">{LOADING_STAGES[loadingStage]}</div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Quá trình này có thể mất từ 10 - 25 giây tùy theo số lượng trang PDF và độ dài đề thi.
                </p>
              </div>
            ) : (
              <div className="pdf-import-wrapper">
                {/* Drag & drop zone */}
                <div
                  className={`pdf-drop-zone ${isDragging ? "drag-active" : ""} ${files.length > 0 ? "has-files" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                  <div className="pdf-drop-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div className="pdf-drop-text">
                    <strong>Kéo thả đề PDF vào đây</strong>
                    <span>hoặc bấm <strong>+ Chọn file PDF</strong> từ thiết bị</span>
                  </div>
                  <div className="pdf-drop-badge">Tối đa {MAX_FILES} file · Mỗi file ≤ 10MB · Định dạng PDF</div>
                </div>

                {/* Uploaded File List */}
                {files.length > 0 && (
                  <div className="pdf-file-list">
                    <div className="pdf-file-header">
                      <span>Danh sách file PDF đã chọn</span>
                      <span className="badge-tag">Đã chọn: {files.length}/{MAX_FILES} file</span>
                    </div>
                    {files.map((file, index) => (
                      <div key={index} className="pdf-file-item">
                        <div className="pdf-file-info">
                          <div className="pdf-file-icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="pdf-file-details">
                            <span className="pdf-file-name">{file.name}</span>
                            <span className="pdf-file-size">{formatFileSize(file.size)}</span>
                          </div>
                          <span className="pdf-file-status-badge">Sẵn sàng</span>
                        </div>
                        <button
                          type="button"
                          className="pdf-file-remove"
                          onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                          title={`Xóa file ${file.name}`}
                          aria-label={`Xóa file ${file.name}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Flow Explanation */}
                <div className="pdf-flow-explanation">
                  <div className="pdf-flow-desc">
                    <span style={{ fontSize: "1.1rem" }}>💡</span>
                    <span>
                      AI sẽ tự động phân tích cấu trúc đề mẫu, bao gồm số lượng câu hỏi, loại câu hỏi và mức độ nhận thức, sau đó tạo một đề mới có cấu trúc tương tự nhưng nội dung hoàn toàn khác.
                    </span>
                  </div>
                  <div className="pdf-flow-stepper">
                    <div className="pdf-flow-step">
                      <div className="pdf-flow-icon">📄</div>
                      <span className="pdf-flow-label">Đề mẫu</span>
                    </div>
                    <span className="pdf-flow-arrow">→</span>
                    <div className="pdf-flow-step">
                      <div className="pdf-flow-icon">🔍</div>
                      <span className="pdf-flow-label">Phân tích cấu trúc</span>
                    </div>
                    <span className="pdf-flow-arrow">→</span>
                    <div className="pdf-flow-step">
                      <div className="pdf-flow-icon">🤖</div>
                      <span className="pdf-flow-label">AI tạo đề mới</span>
                    </div>
                    <span className="pdf-flow-arrow">→</span>
                    <div className="pdf-flow-step">
                      <div className="pdf-flow-icon">📝</div>
                      <span className="pdf-flow-label">Giáo viên review</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={handleClose} disabled={isGenerating}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-primary btn-ai-generate"
                onClick={handleGenerate}
                disabled={isGenerating || files.length === 0}
              >
                {isGenerating ? (
                  <span className="spinner-container">
                    <span className="spinner"></span>
                    <span>Đang xử lý...</span>
                  </span>
                ) : (
                  <>
                    <span className="sparkle-icon" style={{ marginRight: 6 }}>✨</span>
                    Phân tích & tạo đề
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RESULT & REVIEW UI */}
        {step === "review" && generatedAssignment && (
          <div className="modal-body review-body">
            {/* Header Exam Info */}
            <div className="review-banner">
              <div className="banner-info">
                <span className="badge-tag">{formatClassLevel(generatedAssignment.class_level)}</span>
                <span className="badge-tag">{generatedAssignment.subject}</span>
                <span className="badge-tag">{generatedAssignment.duration_minutes} Phút</span>
                <span className="badge-tag tag-success">{editableQuestions.length} Câu hỏi</span>
              </div>
              <h4 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.1rem" }}>{generatedAssignment.title}</h4>
              <p className="banner-note" style={{ margin: 0 }}>
                💡 AI đã phân tích và sinh đề mới thành công! Bạn có thể xem cấu trúc, chỉnh sửa từng câu hoặc bấm <strong>Lưu bài tập</strong>.
              </p>
            </div>

            {/* Read-only Structure Breakdown Summary */}
            <div className="pdf-summary-grid">
              <div className="pdf-summary-card">
                <div className="pdf-summary-title">
                  <span>📌 Phân bố dạng câu hỏi ({editableQuestions.length} câu)</span>
                </div>
                <div className="pdf-summary-tags">
                  {typeCounts.SINGLE_CHOICE > 0 && <span className="badge-tag">Chọn 1 đáp án: {typeCounts.SINGLE_CHOICE}</span>}
                  {typeCounts.MULTIPLE_CHOICE > 0 && <span className="badge-tag">Chọn nhiều: {typeCounts.MULTIPLE_CHOICE}</span>}
                  {typeCounts.TRUE_FALSE > 0 && <span className="badge-tag">Đúng/Sai: {typeCounts.TRUE_FALSE}</span>}
                  {typeCounts.SHORT_ANSWER > 0 && <span className="badge-tag">Trả lời ngắn: {typeCounts.SHORT_ANSWER}</span>}
                </div>
              </div>

              <div className="pdf-summary-card">
                <div className="pdf-summary-title">
                  <span>🎯 Phân bố mức độ nhận thức</span>
                </div>
                <div className="pdf-summary-tags">
                  <span className="badge-tag">Nhận biết (NB): {levelCounts.NB}</span>
                  <span className="badge-tag">Thông hiểu (TH): {levelCounts.TH}</span>
                  <span className="badge-tag">Vận dụng (VD): {levelCounts.VD}</span>
                </div>
              </div>
            </div>

            {/* Question Cards List */}
            <div className="review-questions-list">
              {editableQuestions.map((q, qIndex) => (
                <div key={qIndex} className="question-review-card">
                  <div className="question-review-header">
                    <span className="q-number">Câu {qIndex + 1}:</span>
                    <span className={`q-type-badge ${getQuestionTypeBadgeClass(q.question_type)}`}>
                      {QUESTION_TYPE_LABELS[q.question_type]}
                    </span>
                    <span className="badge-tag" style={{ marginLeft: "auto" }}>
                      {LEVEL_LABELS[q.cognitive_level || "TH"]}
                    </span>
                  </div>

                  {/* Question Content */}
                  <div className="form-group">
                    {isEditing ? (
                      <input
                        type="text"
                        className="question-input"
                        value={q.content}
                        onChange={(e) => {
                          const updated = [...editableQuestions];
                          updated[qIndex].content = e.target.value;
                          setEditableQuestions(updated);
                        }}
                      />
                    ) : (
                      <div className="q-text" style={{ fontSize: "0.95rem", fontWeight: 600 }}><MathText text={q.content} /></div>
                    )}
                  </div>

                  {/* Answers */}
                  {(q.question_type === "SINGLE_CHOICE" || q.question_type === "MULTIPLE_CHOICE") && (
                    <div className="answers-review-grid">
                      {q.answers && q.answers.map((ans, aIndex) => (
                        <div key={aIndex} className={`answer-option-row ${ans.isCorrect ? "is-correct" : ""}`}>
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className={`btn-check-correct ${ans.isCorrect ? "checked" : ""}`}
                                onClick={() => {
                                  const updated = [...editableQuestions];
                                  const quest = updated[qIndex];
                                  if (!quest.answers) return;
                                  if (quest.question_type === "SINGLE_CHOICE") {
                                    quest.answers.forEach((a, idx) => { a.isCorrect = idx === aIndex; });
                                  } else {
                                    quest.answers[aIndex].isCorrect = !quest.answers[aIndex].isCorrect;
                                  }
                                  setEditableQuestions(updated);
                                }}
                              >
                                {ans.isCorrect ? "✓" : ""}
                              </button>
                              <input
                                type="text"
                                className="answer-input"
                                value={ans.content}
                                onChange={(e) => {
                                  const updated = [...editableQuestions];
                                  if (updated[qIndex].answers) {
                                    updated[qIndex].answers![aIndex].content = e.target.value;
                                    setEditableQuestions(updated);
                                  }
                                }}
                              />
                            </>
                          ) : (
                            <div className={`answer-detail-item ${ans.isCorrect ? "correct" : ""}`} style={{ flex: 1 }}>
                              <span className="ans-prefix">{String.fromCharCode(65 + aIndex)}.</span>
                              <span className="ans-content"><MathText text={ans.content} /></span>
                              {ans.isCorrect && <span className="correct-mark">✓ Đáp án đúng</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "TRUE_FALSE" && (
                    <div className="tf-options-group">
                      <div className={`tf-btn ${q.answer === "true" ? "selected" : ""}`} style={{ cursor: "default" }}>
                        {q.answer === "true" ? "✓ Đúng (Đáp án đúng)" : "○ Đúng"}
                      </div>
                      <div className={`tf-btn ${q.answer === "false" ? "selected" : ""}`} style={{ cursor: "default" }}>
                        {q.answer === "false" ? "✓ Sai (Đáp án đúng)" : "○ Sai"}
                      </div>
                    </div>
                  )}

                  {q.question_type === "SHORT_ANSWER" && (
                    <div className="short-answer-display-box">
                      <span>✓ Đáp án đúng:</span>
                      <strong><MathText text={q.answer || "Chưa có đáp án"} /></strong>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Review Actions */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep("upload")}
                disabled={isSaving}
              >
                ← Tạo lại
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isSaving}
              >
                {isEditing ? "👁️ Xem chế độ đọc" : "✏️ Chỉnh sửa"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setPrintShowAnswers(true); setShowPrintPreview(true); }}
                title="Xem trước bản in"
              >
                🖨️ In đề + Đáp án
              </button>
              <button
                type="button"
                className="btn-primary btn-save"
                onClick={handleSaveAssignment}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="spinner-container">
                    <span className="spinner"></span>
                    <span>Đang lưu...</span>
                  </span>
                ) : (
                  <span>💾 Lưu bài tập</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showPrintPreview && generatedAssignment && (
        <PrintablePreview
          assignment={generatedAssignment}
          showAnswers={printShowAnswers}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
};

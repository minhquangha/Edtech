import React, { useState, useEffect } from "react";
import type { Assignment, AssignmentUpdateRequest, QuestionType, Question, EditableQuestion } from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { PrintablePreview } from "./PrintablePreview";
import { MathText } from "./MathText";

interface AssignmentDetailModalProps {
  assignment: Assignment | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CLASS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `Lớp ${i + 1}`,
  value: `${i + 1}`,
}));

const formatClassLevel = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "Lớp --";
  const str = String(val).trim();
  if (!str) return "Lớp --";
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
};

const getQuestionTypeLabel = (type: QuestionType): string => {
  switch (type) {
    case "SINGLE_CHOICE":
      return "Một đáp án";
    case "MULTIPLE_CHOICE":
      return "Nhiều đáp án";
    case "TRUE_FALSE":
      return "Đúng / Sai";
    case "SHORT_ANSWER":
      return "Trả lời ngắn";
    default:
      return type;
  }
};

const getQuestionTypeBadgeClass = (type: QuestionType): string => {
  switch (type) {
    case "SINGLE_CHOICE":
      return "type-single";
    case "MULTIPLE_CHOICE":
      return "type-multi";
    case "TRUE_FALSE":
      return "type-tf";
    case "SHORT_ANSWER":
      return "type-sa";
    default:
      return "type-single";
  }
};

export const AssignmentDetailModal: React.FC<AssignmentDetailModalProps> = ({
  assignment,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Form State
  const [editTitle, setEditTitle] = useState<string>("");
  const [editSubject, setEditSubject] = useState<string>("");
  const [editClassLevel, setEditClassLevel] = useState<string>("10");
  const [editDuration, setEditDuration] = useState<number>(15);
  const [editDescription, setEditDescription] = useState<string>("");
  const [editQuestions, setEditQuestions] = useState<EditableQuestion[]>([]);

  // Print preview state
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [printShowAnswers, setPrintShowAnswers] = useState<boolean>(false);

  // Initialize edit form state when assignment changes or edit mode turns on
  useEffect(() => {
    if (assignment) {
      setEditTitle(assignment.title || "");
      setEditSubject(assignment.subject || "");
      setEditClassLevel(String(assignment.class_level || "10").replace(/[^0-9]/g, "") || "10");
      setEditDuration(assignment.duration_minutes || 15);
      setEditDescription(assignment.description || "");
      setEditQuestions(
        (assignment.questions || []).map((q) => {
          const qType: QuestionType = q.question_type || "SINGLE_CHOICE";
          let answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";
          if (qType === "TRUE_FALSE" && answerVal !== "true" && answerVal !== "false") {
            const correctAns = (q.answers || []).find((a) => a.isCorrect);
            if (correctAns) {
              answerVal = /đúng|true|1/i.test(correctAns.content) ? "true" : "false";
            } else {
              answerVal = "true";
            }
          } else if (qType === "SHORT_ANSWER" && !answerVal && q.answers && q.answers.length > 0) {
            answerVal = q.answers[0].content || "";
          }

          return {
            id: q.id,
            content: q.content,
            question_type: qType,
            answer: answerVal,
            answers: (q.answers || []).map((a) => ({
              id: a.id,
              content: a.content,
              isCorrect: Boolean(a.isCorrect),
            })),
          };
        })
      );
    }
  }, [assignment, isEditing]);

  if (!assignment) return null;

  const handleStartEdit = () => {
    setIsEditing(true);
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setErrorMsg(null);
  };

  const handleQuestionContentChange = (qIdx: number, val: string) => {
    const updated = [...editQuestions];
    updated[qIdx].content = val;
    setEditQuestions(updated);
  };

  const handleQuestionTypeChange = (qIdx: number, newType: QuestionType) => {
    const updated = [...editQuestions];
    const oldQuestion = updated[qIdx];

    if (newType === "TRUE_FALSE") {
      updated[qIdx] = {
        ...oldQuestion,
        question_type: "TRUE_FALSE",
        answer: oldQuestion.answer === "true" || oldQuestion.answer === "false" ? oldQuestion.answer : "true",
        answers: [],
      };
    } else if (newType === "SHORT_ANSWER") {
      updated[qIdx] = {
        ...oldQuestion,
        question_type: "SHORT_ANSWER",
        answer: oldQuestion.answer || "",
        answers: [],
      };
    } else {
      let existingAnswers = oldQuestion.answers || [];
      if (existingAnswers.length === 0) {
        existingAnswers = [
          { id: 1, content: "Lựa chọn A", isCorrect: true },
          { id: 2, content: "Lựa chọn B", isCorrect: false },
          { id: 3, content: "Lựa chọn C", isCorrect: false },
          { id: 4, content: "Lựa chọn D", isCorrect: false },
        ];
      } else if (newType === "SINGLE_CHOICE") {
        let found = false;
        existingAnswers = existingAnswers.map((a) => {
          if (a.isCorrect && !found) {
            found = true;
            return { ...a, isCorrect: true };
          }
          return { ...a, isCorrect: false };
        });
        if (!found && existingAnswers.length > 0) {
          existingAnswers[0].isCorrect = true;
        }
      }
      updated[qIdx] = {
        ...oldQuestion,
        question_type: newType,
        answer: "",
        answers: existingAnswers,
      };
    }
    setEditQuestions(updated);
  };

  const handleAnswerContentChange = (qIdx: number, aIdx: number, val: string) => {
    const updated = [...editQuestions];
    if (updated[qIdx].answers) {
      updated[qIdx].answers![aIdx].content = val;
      setEditQuestions(updated);
    }
  };

  const handleToggleCorrect = (qIdx: number, aIdx: number) => {
    const updated = [...editQuestions];
    const question = updated[qIdx];
    if (!question.answers) return;

    if (question.question_type === "SINGLE_CHOICE") {
      question.answers.forEach((ans, idx: number) => {
        ans.isCorrect = idx === aIdx;
      });
    } else {
      question.answers[aIdx].isCorrect = !question.answers[aIdx].isCorrect;
    }
    setEditQuestions(updated);
  };

  const handleTrueFalseEditChange = (qIdx: number, val: "true" | "false") => {
    const updated = [...editQuestions];
    updated[qIdx].answer = val;
    setEditQuestions(updated);
  };

  const handleShortAnswerEditChange = (qIdx: number, val: string) => {
    const updated = [...editQuestions];
    updated[qIdx].answer = val;
    setEditQuestions(updated);
  };

  // Submit PUT /assignments/edit/:id
  const handleSaveUpdate = async () => {
    if (!token || !assignment) return;

    // Validate questions
    for (let i = 0; i < editQuestions.length; i++) {
      const q = editQuestions[i];
      const qNum = i + 1;
      if (!q.content || !q.content.trim()) {
        setErrorMsg(`Câu ${qNum} không được để trống nội dung`);
        return;
      }

      if (q.question_type === "SINGLE_CHOICE") {
        if (!q.answers || q.answers.length === 0) {
          setErrorMsg(`Câu ${qNum} phải có ít nhất 1 lựa chọn`);
          return;
        }
        const correctCount = q.answers.filter((a) => a.isCorrect).length;
        if (correctCount !== 1) {
          setErrorMsg(`Câu ${qNum} (Một đáp án) phải chọn đúng 1 đáp án đúng`);
          return;
        }
      } else if (q.question_type === "MULTIPLE_CHOICE") {
        if (!q.answers || q.answers.length === 0) {
          setErrorMsg(`Câu ${qNum} phải có ít nhất 1 lựa chọn`);
          return;
        }
        const correctCount = q.answers.filter((a) => a.isCorrect).length;
        if (correctCount < 1) {
          setErrorMsg(`Câu ${qNum} (Nhiều đáp án) phải chọn ít nhất 1 đáp án đúng`);
          return;
        }
      } else if (q.question_type === "TRUE_FALSE") {
        if (q.answer !== "true" && q.answer !== "false") {
          setErrorMsg(`Câu ${qNum} (Đúng / Sai) chưa chọn đáp án đúng`);
          return;
        }
      } else if (q.question_type === "SHORT_ANSWER") {
        if (!q.answer || !q.answer.trim()) {
          setErrorMsg(`Câu ${qNum} (Trả lời ngắn) chưa nhập đáp án đúng`);
          return;
        }
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatePayload: AssignmentUpdateRequest = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        class_level: editClassLevel,
        duration_minutes: Number(editDuration) || 15,
        subject: editSubject.trim(),
        questions: editQuestions.map((q) => {
          if (q.question_type === "TRUE_FALSE") {
            return {
              id: q.id,
              content: q.content,
              question_type: q.question_type,
              answer: q.answer || "true",
              answers: [],
            };
          }
          if (q.question_type === "SHORT_ANSWER") {
            return {
              id: q.id,
              content: q.content,
              question_type: q.question_type,
              answer: q.answer ? q.answer.trim() : "",
              answers: [],
            };
          }
          return {
            id: q.id,
            content: q.content,
            question_type: q.question_type,
            answers: (q.answers || []).map((a) => ({
              id: a.id,
              content: a.content,
              isCorrect: Boolean(a.isCorrect),
            })),
          };
        }),
      };

      await api.updateAssignment(assignment.id, updatePayload, token);

      // Mutate local assignment object for immediate UI refresh
      assignment.title = updatePayload.title;
      assignment.description = updatePayload.description;
      assignment.class_level = updatePayload.class_level;
      assignment.duration_minutes = updatePayload.duration_minutes;
      assignment.subject = updatePayload.subject;
      assignment.questions = updatePayload.questions as Question[];

      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Không thể cập nhật bài tập");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-large">
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>
              {isEditing ? "✏️ Chỉnh Sửa Bài Tập" : `📖 Chi Tiết Bài Tập: ${assignment.title}`}
            </h3>
            {!isEditing && (
              <div className="detail-badges">
                <span className="badge-tag">{formatClassLevel(assignment.class_level)}</span>
                <span className="badge-tag">{assignment.subject}</span>
                <span className="badge-tag">{assignment.duration_minutes} Phút</span>
                <span className="badge-tag tag-success">{assignment.questions?.length || 0} Câu hỏi</span>
              </div>
            )}
          </div>
          <button className="btn-close" onClick={onClose} disabled={isSaving}>
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error margin-horizontal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="modal-body">
          {/* VIEW MODE */}
          {!isEditing && (
            <>
              {assignment.description && (
                <div className="detail-description">
                  <strong>Mô tả:</strong> {assignment.description}
                </div>
              )}

              <div className="detail-questions-list">
                {assignment.questions && assignment.questions.length > 0 ? (
                  assignment.questions.map((q, index) => {
                    const qType: QuestionType = q.question_type || "SINGLE_CHOICE";
                    const answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";

                    return (
                      <div key={q.id || index} className="question-detail-card">
                        <div className="question-detail-header">
                          <span className="q-number">Câu {index + 1}:</span>
                          <span className="q-text"><MathText text={q.content} /></span>
                          <span className={`q-type-badge ${getQuestionTypeBadgeClass(qType)}`}>
                            {getQuestionTypeLabel(qType)}
                          </span>
                        </div>

                        {/* SINGLE_CHOICE / MULTIPLE_CHOICE */}
                        {(qType === "SINGLE_CHOICE" || qType === "MULTIPLE_CHOICE") && (
                          <div className="answers-detail-grid">
                            {q.answers && q.answers.length > 0 ? (
                              q.answers.map((ans, aIdx) => (
                                <div
                                  key={ans.id || aIdx}
                                  className={`answer-detail-item ${ans.isCorrect ? "correct" : ""}`}
                                >
                                  <span className="ans-prefix">
                                    {String.fromCharCode(65 + aIdx)}.
                                  </span>
                                  <span className="ans-content"><MathText text={ans.content} /></span>
                                  {ans.isCorrect && <span className="correct-mark">✓ Đáp án đúng</span>}
                                </div>
                              ))
                            ) : (
                              <p className="empty-text">Chưa có danh sách đáp án cho câu hỏi này.</p>
                            )}
                          </div>
                        )}

                        {/* TRUE_FALSE */}
                        {qType === "TRUE_FALSE" && (
                          <div className="tf-options-group">
                            <div className={`tf-btn ${answerVal === "true" ? "selected" : ""}`} style={{ cursor: "default" }}>
                              {answerVal === "true" ? "✓ Đúng (Đáp án đúng)" : "○ Đúng"}
                            </div>
                            <div className={`tf-btn ${answerVal === "false" ? "selected" : ""}`} style={{ cursor: "default" }}>
                              {answerVal === "false" ? "✓ Sai (Đáp án đúng)" : "○ Sai"}
                            </div>
                          </div>
                        )}

                        {/* SHORT_ANSWER */}
                        {qType === "SHORT_ANSWER" && (
                          <div className="short-answer-display-box">
                            <span>✓ Đáp án đúng:</span>
                            <strong><MathText text={answerVal || (q.answers && q.answers.length > 0 ? q.answers[0].content : "Chưa có đáp án")} /></strong>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-text">Chưa có thông tin chi tiết câu hỏi cho bài tập này.</p>
                )}
              </div>
            </>
          )}

          {/* EDIT MODE (PUT /assignments/edit/:id) */}
          {isEditing && (
            <div className="edit-assignment-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="editClassLevel">Lớp học</label>
                  <select
                    id="editClassLevel"
                    className="custom-select"
                    value={editClassLevel}
                    onChange={(e) => setEditClassLevel(e.target.value)}
                  >
                    {CLASS_OPTIONS.map((cls) => (
                      <option key={cls.value} value={cls.value}>
                        {cls.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="editSubject">Môn học</label>
                  <input
                    id="editSubject"
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="editTitle">Tên bài tập</label>
                  <input
                    id="editTitle"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="editDuration">Thời gian (Phút)</label>
                  <input
                    id="editDuration"
                    type="number"
                    min="5"
                    max="180"
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 15)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="editDescription">Mô tả bài tập</label>
                <textarea
                  id="editDescription"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <h4 style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>Chỉnh Sửa Nội Dung Câu Hỏi & Đáp Án</h4>

              <div className="review-questions-list">
                {editQuestions.map((q, qIndex) => (
                  <div key={q.id || qIndex} className="question-review-card">
                    <div className="question-review-header">
                      <span className="q-number">Câu {qIndex + 1}:</span>
                      <select
                        className="custom-select"
                        style={{ width: "auto", padding: "0.3rem 2rem 0.3rem 0.6rem", fontSize: "0.8rem" }}
                        value={q.question_type}
                        onChange={(e) =>
                          handleQuestionTypeChange(qIndex, e.target.value as QuestionType)
                        }
                      >
                        <option value="SINGLE_CHOICE">Một đáp án</option>
                        <option value="MULTIPLE_CHOICE">Nhiều đáp án</option>
                        <option value="TRUE_FALSE">Đúng / Sai</option>
                        <option value="SHORT_ANSWER">Trả lời ngắn</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <input
                        type="text"
                        className="question-input"
                        value={q.content}
                        onChange={(e) => handleQuestionContentChange(qIndex, e.target.value)}
                      />
                    </div>

                    {/* CHOICE-BASED QUESTIONS (SINGLE_CHOICE / MULTIPLE_CHOICE) */}
                    {(q.question_type === "SINGLE_CHOICE" || q.question_type === "MULTIPLE_CHOICE") && (
                      <div className="answers-review-grid">
                        {q.answers && q.answers.map((ans, aIndex: number) => (
                          <div
                            key={ans.id || aIndex}
                            className={`answer-option-row ${ans.isCorrect ? "is-correct" : ""}`}
                          >
                            <button
                              type="button"
                              className={`btn-check-correct ${ans.isCorrect ? "checked" : ""}`}
                              onClick={() => handleToggleCorrect(qIndex, aIndex)}
                              title={ans.isCorrect ? "Đáp án đúng" : "Đánh dấu là đáp án đúng"}
                            >
                              {ans.isCorrect ? "✓" : ""}
                            </button>
                            <input
                              type="text"
                              className="answer-input"
                              value={ans.content}
                              onChange={(e) => handleAnswerContentChange(qIndex, aIndex, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TRUE / FALSE QUESTION */}
                    {q.question_type === "TRUE_FALSE" && (
                      <div className="tf-options-group">
                        <button
                          type="button"
                          className={`tf-btn ${q.answer === "true" ? "selected" : ""}`}
                          onClick={() => handleTrueFalseEditChange(qIndex, "true")}
                        >
                          {q.answer === "true" ? "✓ " : "○ "}Đúng
                        </button>
                        <button
                          type="button"
                          className={`tf-btn ${q.answer === "false" ? "selected" : ""}`}
                          onClick={() => handleTrueFalseEditChange(qIndex, "false")}
                        >
                          {q.answer === "false" ? "✓ " : "○ "}Sai
                        </button>
                      </div>
                    )}

                    {/* SHORT ANSWER QUESTION */}
                    {q.question_type === "SHORT_ANSWER" && (
                      <div className="short-answer-input-group">
                        <label className="short-answer-label">Đáp án đúng:</label>
                        <input
                          type="text"
                          className="answer-input"
                          placeholder="Nhập đáp án đúng..."
                          value={q.answer || ""}
                          onChange={(e) => handleShortAnswerEditChange(qIndex, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!isEditing ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setPrintShowAnswers(false); setShowPrintPreview(true); }}
                title="Xem trước & in đề (không đáp án)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                In đề
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setPrintShowAnswers(true); setShowPrintPreview(true); }}
                title="Xem trước & in đề + đáp án"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                  <line x1="9" y1="11" x2="15" y2="11" />
                </svg>
                In đề + đáp án
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartEdit}
              >
                ✏️ Chỉnh sửa
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Đóng
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Hủy chỉnh sửa
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveUpdate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="spinner-container">
                    <span className="spinner"></span>
                    <span>Đang lưu thay đổi...</span>
                  </span>
                ) : (
                  <span>💾 Lưu thay đổi</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Print Preview Overlay */}
      {showPrintPreview && (
        <PrintablePreview
          assignment={assignment}
          showAnswers={printShowAnswers}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
};

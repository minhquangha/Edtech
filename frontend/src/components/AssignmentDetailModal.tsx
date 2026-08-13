import React, { useState, useEffect } from "react";
import type { Assignment, AssignmentUpdateRequest } from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

interface AssignmentDetailModalProps {
  assignment: Assignment | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CLASS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `Lớp ${i + 1}`,
  value: `${i + 1}`,
}));

const formatClassLevel = (val: any): string => {
  if (val === null || val === undefined) return "Lớp --";
  const str = String(val).trim();
  if (!str) return "Lớp --";
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
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
  const [editQuestions, setEditQuestions] = useState<any[]>([]);

  // Initialize edit form state when assignment changes or edit mode turns on
  useEffect(() => {
    if (assignment) {
      setEditTitle(assignment.title || "");
      setEditSubject(assignment.subject || "");
      setEditClassLevel(String(assignment.class_level || "10").replace(/[^0-9]/g, "") || "10");
      setEditDuration(assignment.duration_minutes || 15);
      setEditDescription(assignment.description || "");
      setEditQuestions(
        (assignment.questions || []).map((q) => ({
          id: q.id,
          content: q.content,
          question_type: q.question_type || "SINGLE_CHOICE",
          answers: (q.answers || []).map((a) => ({
            id: a.id,
            content: a.content,
            isCorrect: Boolean(a.isCorrect),
          })),
        }))
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

  const handleQuestionTypeChange = (qIdx: number, type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE") => {
    const updated = [...editQuestions];
    updated[qIdx].question_type = type;
    setEditQuestions(updated);
  };

  const handleAnswerContentChange = (qIdx: number, aIdx: number, val: string) => {
    const updated = [...editQuestions];
    updated[qIdx].answers[aIdx].content = val;
    setEditQuestions(updated);
  };

  const handleToggleCorrect = (qIdx: number, aIdx: number) => {
    const updated = [...editQuestions];
    const question = updated[qIdx];
    if (question.question_type === "SINGLE_CHOICE") {
      question.answers.forEach((ans: any, idx: number) => {
        ans.isCorrect = idx === aIdx;
      });
    } else {
      question.answers[aIdx].isCorrect = !question.answers[aIdx].isCorrect;
    }
    setEditQuestions(updated);
  };

  // Submit PUT /assignments/edit/:id
  const handleSaveUpdate = async () => {
    if (!token || !assignment) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatePayload: AssignmentUpdateRequest = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        class_level: editClassLevel,
        duration_minutes: Number(editDuration) || 15,
        subject: editSubject.trim(),
        questions: editQuestions.map((q) => ({
          id: q.id,
          content: q.content,
          question_type: q.question_type,
          answers: q.answers.map((a: any) => ({
            id: a.id,
            content: a.content,
            isCorrect: Boolean(a.isCorrect),
          })),
        })),
      };

      await api.updateAssignment(assignment.id, updatePayload, token);

      // Mutate local assignment object for immediate UI refresh
      assignment.title = updatePayload.title;
      assignment.description = updatePayload.description;
      assignment.class_level = updatePayload.class_level;
      assignment.duration_minutes = updatePayload.duration_minutes;
      assignment.subject = updatePayload.subject;
      assignment.questions = updatePayload.questions as any;

      setIsEditing(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể cập nhật bài tập");
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
                  assignment.questions.map((q, index) => (
                    <div key={q.id || index} className="question-detail-card">
                      <div className="question-detail-header">
                        <span className="q-number">Câu {index + 1}:</span>
                        <span className="q-text">{q.content}</span>
                        <span className={`q-type-badge ${q.question_type === "SINGLE_CHOICE" ? "type-single" : "type-multi"}`}>
                          {q.question_type === "SINGLE_CHOICE" ? "1 Đáp án đúng" : "Nhiều đáp án đúng"}
                        </span>
                      </div>

                      <div className="answers-detail-grid">
                        {q.answers && q.answers.map((ans, aIdx) => (
                          <div
                            key={ans.id || aIdx}
                            className={`answer-detail-item ${ans.isCorrect ? "correct" : ""}`}
                          >
                            <span className="ans-prefix">
                              {String.fromCharCode(65 + aIdx)}.
                            </span>
                            <span className="ans-content">{ans.content}</span>
                            {ans.isCorrect && <span className="correct-mark">✓ Đáp án đúng</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
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
                          handleQuestionTypeChange(qIndex, e.target.value as any)
                        }
                      >
                        <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                        <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
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

                    <div className="answers-review-grid">
                      {q.answers && q.answers.map((ans: any, aIndex: number) => (
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
                className="btn-primary"
                onClick={handleStartEdit}
                style={{ backgroundColor: "#0284c7" }}
              >
                ✏️ Chỉnh sửa bài tập
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
    </div>
  );
};

import React, { useState, useRef, useCallback } from "react";
import type { AssignmentRequest, QuestionType } from "../types";
import { api } from "../services/api";

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignment: AssignmentRequest) => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Difficulty = "easy" | "medium" | "hard";

interface QuestionGroup {
  id: string;
  type: QuestionType;
  count: number;
  difficulty: Difficulty;
}

const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "◯",
  MULTIPLE_CHOICE: "☑",
  TRUE_FALSE: "✓",
  SHORT_ANSWER: "✎",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Một đáp án",
  MULTIPLE_CHOICE: "Nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "var(--diff-easy, #10b981)",
  medium: "var(--diff-medium, #f59e0b)",
  hard: "var(--diff-hard, #ef4444)",
};

export const ImportPdfModal: React.FC<ImportPdfModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Metadata
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [extraRequirements, setExtraRequirements] = useState("");

  // Question groups
  const [groups, setGroups] = useState<QuestionGroup[]>([
    { id: "g-1", type: "SINGLE_CHOICE", count: 5, difficulty: "medium" },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupCounter = useRef(1);

  const resetState = useCallback(() => {
    setFiles([]);
    setErrorMsg(null);
    setTitle("");
    setSubject("");
    setClassLevel("");
    setDurationMinutes(30);
    setExtraRequirements("");
    setGroups([{ id: "g-1", type: "SINGLE_CHOICE", count: 5, difficulty: "medium" }]);
    groupCounter.current = 1;
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── File handling ──

  const validateAndAddFiles = (incoming: File[]) => {
    setErrorMsg(null);

    const pdfFiles = incoming.filter((f) => f.type === "application/pdf");
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
    if (e.target.files) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndAddFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Question group handling ──

  const addGroup = () => {
    groupCounter.current += 1;
    setGroups((prev) => [
      ...prev,
      { id: `g-${groupCounter.current}`, type: "SINGLE_CHOICE", count: 5, difficulty: "medium" },
    ]);
  };

  const updateGroup = (id: string, patch: Partial<QuestionGroup>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGroup = (id: string) => {
    setGroups((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== id) : prev));
  };

  const totalQuestions = groups.reduce((sum, g) => sum + (g.count || 0), 0);

  // ── Submit ──

  const handleGenerate = async () => {
    if (files.length === 0) {
      setErrorMsg("Vui lòng tải lên ít nhất 1 file PDF.");
      return;
    }

    if (totalQuestions === 0) {
      setErrorMsg("Tổng số câu hỏi phải lớn hơn 0.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const result = await api.importPdfsAndGenerate(files, {
        title: title.trim() || undefined,
        subject: subject.trim() || undefined,
        class_level: classLevel.trim() || undefined,
        grade_id: classLevel.trim() ? Number(classLevel.trim()) : undefined,
        duration_minutes: durationMinutes,
        question_groups: groups.map((g) => ({
          type: g.type,
          count: g.count,
          difficulty: g.difficulty,
        })),
        extra_requirements: extraRequirements.trim() || undefined,
      });

      const rawData = result.data;
      const normalizedQuestions = (rawData.questions || []).map((q: any) => {
        const qType: QuestionType = q.question_type || q.type || "SINGLE_CHOICE";
        return {
          content: q.content || "",
          question_type: qType,
          ...(qType === "SHORT_ANSWER" || qType === "TRUE_FALSE"
            ? { answer: String(q.answer ?? "") }
            : {}),
          answers: (q.answers || []).map((a: any) => ({
            content: a.content || "",
            isCorrect: Boolean(a.isCorrect),
          })),
        };
      });

      const normalized: AssignmentRequest = {
        ...rawData,
        questions: normalizedQuestions,
      };

      onSuccess(normalized);
      resetState();
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tạo bài tập từ PDF. Vui lòng thử lại!");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container modal-large">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>
              <span className="sparkle-icon">📄</span> Import PDF & Tạo Đề Mới
            </h3>
            <p className="modal-subtitle">
              Tải lên PDF, AI đọc nội dung và tự động sinh đề thi theo cấu hình của bạn
            </p>
          </div>
          <button className="btn-close" onClick={handleClose} disabled={isGenerating} aria-label="Đóng">
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
          {/* ── STEP 1: Upload PDF ── */}
          <div className="pdf-import-step">
            <div className="pdf-import-step-label">
              <span className="step-number">1</span>
              <span className="step-title">Tài liệu PDF</span>
              <span className="step-meta">{files.length}/{MAX_FILES} file</span>
            </div>

            <div
              className={`pdf-drop-zone ${isDragging ? "drag-active" : ""} ${files.length > 0 ? "has-files" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
              aria-label="Kéo thả hoặc chọn file PDF"
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
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="pdf-drop-text">
                <strong>Kéo thả file PDF vào đây</strong>
                <span>hoặc bấm để chọn từ thiết bị</span>
              </div>
              <div className="pdf-drop-badge">
                Tối đa {MAX_FILES} file · mỗi file ≤ 10MB
              </div>
            </div>

            {files.length > 0 && (
              <div className="pdf-file-list">
                {files.map((file, index) => (
                  <div key={index} className="pdf-file-item">
                    <div className="pdf-file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="pdf-file-info">
                      <span className="pdf-file-name">{file.name}</span>
                      <span className="pdf-file-size">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="pdf-file-remove"
                      onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                      disabled={isGenerating}
                      aria-label={`Xóa file ${file.name}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── STEP 2: Metadata ── */}
          <div className="pdf-import-step">
            <div className="pdf-import-step-label">
              <span className="step-number">2</span>
              <span className="step-title">Thông tin đề thi</span>
              <span className="step-meta">Tùy chọn</span>
            </div>

            <div className="pdf-meta-grid">
              <div className="form-group">
                <label htmlFor="pdf-title">Tiêu đề</label>
                <input
                  id="pdf-title"
                  type="text"
                  placeholder="VD: Kiểm tra 15 phút chương 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pdf-subject">Môn học</label>
                <input
                  id="pdf-subject"
                  type="text"
                  placeholder="VD: Vật lý"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pdf-class">Lớp</label>
                <input
                  id="pdf-class"
                  type="text"
                  placeholder="VD: 12"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pdf-duration">Thời gian (phút)</label>
                <input
                  id="pdf-duration"
                  type="number"
                  min={5}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          </div>

          {/* ── STEP 3: Question Groups ── */}
          <div className="pdf-import-step">
            <div className="pdf-import-step-label">
              <span className="step-number">3</span>
              <span className="step-title">Cấu hình câu hỏi</span>
              <span className="step-meta">
                <strong>{totalQuestions}</strong> câu · {groups.length} nhóm
              </span>
            </div>

            <div className="question-group-list">
              {groups.map((group, index) => (
                <div key={group.id} className="qg-card">
                  {/* Card header */}
                  <div className="qg-card-top">
                    <div className="qg-card-id">
                      <span className="qg-card-num">{index + 1}</span>
                    </div>
                    <div className="qg-card-tags">
                      <span className="qg-tag qg-tag-type">
                        <span className="qg-tag-icon">{QUESTION_TYPE_ICONS[group.type]}</span>
                        {QUESTION_TYPE_LABELS[group.type]}
                      </span>
                      <span className="qg-tag qg-tag-count">{group.count} câu</span>
                      <span
                        className="qg-tag qg-tag-diff"
                        style={{ "--diff-color": DIFFICULTY_COLORS[group.difficulty] } as React.CSSProperties}
                      >
                        {DIFFICULTY_LABELS[group.difficulty]}
                      </span>
                    </div>
                    {groups.length > 1 && (
                      <button
                        type="button"
                        className="qg-card-delete"
                        onClick={() => removeGroup(group.id)}
                        disabled={isGenerating}
                        title="Xóa nhóm này"
                        aria-label={`Xóa nhóm ${index + 1}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Card controls */}
                  <div className="qg-card-controls">
                    <div className="form-group">
                      <label>Loại câu hỏi</label>
                      <select
                        className="custom-select"
                        value={group.type}
                        onChange={(e) => updateGroup(group.id, { type: e.target.value as QuestionType })}
                        disabled={isGenerating}
                      >
                        <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                        <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
                        <option value="TRUE_FALSE">Đúng / Sai</option>
                        <option value="SHORT_ANSWER">Trả lời ngắn</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Số lượng</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={group.count}
                        onChange={(e) => updateGroup(group.id, { count: Math.max(1, parseInt(e.target.value) || 1) })}
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="form-group">
                      <label>Độ khó</label>
                      <select
                        className="custom-select"
                        value={group.difficulty}
                        onChange={(e) => updateGroup(group.id, { difficulty: e.target.value as Difficulty })}
                        disabled={isGenerating}
                      >
                        <option value="easy">Dễ</option>
                        <option value="medium">Trung bình</option>
                        <option value="hard">Khó</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="qg-add-btn"
              onClick={addGroup}
              disabled={isGenerating}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm nhóm câu hỏi
            </button>

            <div className="form-group" style={{ marginTop: "16px" }}>
              <label htmlFor="pdf-extra">Yêu cầu thêm (không bắt buộc)</label>
              <textarea
                id="pdf-extra"
                rows={2}
                placeholder="VD: Tập trung vào phần bài tập cuối chương, tránh câu hỏi lý thuyết..."
                value={extraRequirements}
                onChange={(e) => setExtraRequirements(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isGenerating}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="btn-primary btn-ai-generate"
              onClick={handleGenerate}
              disabled={isGenerating || files.length === 0 || totalQuestions === 0}
            >
              {isGenerating ? (
                <span className="spinner-container">
                  <span className="spinner"></span>
                  <span>AI đang đọc PDF & tạo đề thi...</span>
                </span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Tạo đề từ PDF ({totalQuestions} câu)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

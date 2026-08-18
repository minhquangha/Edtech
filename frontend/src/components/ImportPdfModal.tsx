import React, { useState, useRef, useCallback } from "react";
import type { AssignmentRequest } from "../types";
import { api } from "../services/api";

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (assignment: AssignmentRequest) => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ImportPdfModal: React.FC<ImportPdfModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Optional metadata
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questionCount, setQuestionCount] = useState(10);
  const [questionType, setQuestionType] = useState<"SINGLE_CHOICE" | "MULTIPLE_CHOICE">("SINGLE_CHOICE");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [extraRequirements, setExtraRequirements] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFiles([]);
    setErrorMsg(null);
    setTitle("");
    setSubject("");
    setClassLevel("");
    setDurationMinutes(30);
    setQuestionCount(10);
    setQuestionType("SINGLE_CHOICE");
    setDifficulty("medium");
    setExtraRequirements("");
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

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

  const handleGenerate = async () => {
    if (files.length === 0) {
      setErrorMsg("Vui lòng tải lên ít nhất 1 file PDF.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const result = await api.importPdfsAndGenerate(files, {
        title: title.trim() || undefined,
        subject: subject.trim() || undefined,
        class_level: classLevel.trim() || undefined,
        duration_minutes: durationMinutes,
        question_count: questionCount,
        question_type: questionType,
        difficulty,
        extra_requirements: extraRequirements.trim() || undefined,
      });

      const rawData = result.data;
      const normalizedQuestions = (rawData.questions || []).map((q: any) => ({
        content: q.content || "",
        question_type: q.question_type || q.type || "SINGLE_CHOICE",
        answers: (q.answers || []).map((a: any) => ({
          content: a.content || "",
          isCorrect: Boolean(a.isCorrect),
        })),
      }));

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
              Tải lên tối đa {MAX_FILES} file PDF. AI sẽ đọc nội dung và tạo đề thi mới dựa trên tài liệu.
            </p>
          </div>
          <button className="btn-close" onClick={handleClose} disabled={isGenerating}>
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
          {/* Drop Zone */}
          <div
            className={`drop-zone ${isDragging ? "drag-active" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <div className="drop-zone-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p className="drop-zone-title">Kéo thả file PDF vào đây</p>
              <p className="drop-zone-hint">hoặc click để chọn file (tối đa {MAX_FILES} file, mỗi file ≤ 10MB)</p>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="pdf-file-list">
              {files.map((file, index) => (
                <div key={index} className="pdf-file-item">
                  <div className="pdf-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <div className="pdf-file-info">
                    <span className="pdf-file-name">{file.name}</span>
                    <span className="pdf-file-size">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-file"
                    onClick={() => removeFile(index)}
                    disabled={isGenerating}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Optional metadata */}
          <div className="config-section">
            <div className="config-section-header">
              <div>
                <h4>Thông tin đề thi (Tùy chọn)</h4>
                <span className="config-hint">Nếu không điền, AI sẽ tự suy luận từ nội dung PDF</span>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="pdf-title">Tiêu đề đề thi</label>
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
                  placeholder="VD: Toán học"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="pdf-class">Lớp</label>
                <input
                  id="pdf-class"
                  type="text"
                  placeholder="VD: Lớp 6"
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

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="pdf-count">Số lượng câu hỏi</label>
                <input
                  id="pdf-count"
                  type="number"
                  min={1}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
                  disabled={isGenerating}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pdf-type">Loại câu hỏi</label>
                <select
                  id="pdf-type"
                  className="custom-select"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as "SINGLE_CHOICE" | "MULTIPLE_CHOICE")}
                  disabled={isGenerating}
                >
                  <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
                  <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="pdf-difficulty">Độ khó</label>
              <select
                id="pdf-difficulty"
                className="custom-select"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
                disabled={isGenerating}
              >
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="pdf-extra">Yêu cầu thêm (Không bắt buộc)</label>
              <textarea
                id="pdf-extra"
                rows={2}
                placeholder="VD: Tập trung vào phần bài tập cuối chương..."
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
              disabled={isGenerating || files.length === 0}
            >
              {isGenerating ? (
                <span className="spinner-container">
                  <span className="spinner"></span>
                  <span>AI đang đọc PDF & tạo đề thi...</span>
                </span>
              ) : (
                <>
                  <span>📄 Tạo đề từ PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

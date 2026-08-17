import React, { useState, useRef, useEffect } from "react";
import type { QuestionGroupConfig, Lesson } from "../types";

interface QuestionConfigBlockProps {
  config: QuestionGroupConfig;
  index: number;
  canDelete: boolean;
  availableLessons: Lesson[];
  isLoadingLessons: boolean;
  onUpdate: (updated: QuestionGroupConfig) => void;
  onDelete: () => void;
}

export const QuestionConfigBlock: React.FC<QuestionConfigBlockProps> = ({
  config,
  index,
  canDelete,
  availableLessons,
  isLoadingLessons,
  onUpdate,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLesson = (lessonId: number) => {
    const current = config.lessonIds || [];
    const next = current.includes(lessonId)
      ? current.filter((id) => id !== lessonId)
      : [...current, lessonId];
    onUpdate({ ...config, lessonIds: next });
  };

  const removeLesson = (lessonId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = config.lessonIds || [];
    onUpdate({ ...config, lessonIds: current.filter((id) => id !== lessonId) });
  };

  const selectedLessons = (config.lessonIds || [])
    .map((id) => availableLessons.find((l) => l.id === id))
    .filter((l): l is Lesson => Boolean(l));

  const formatLessonTitle = (l: Lesson): string => {
    const title = (l.title || "").trim();
    if (/^bài\s*\d+/i.test(title)) {
      return title;
    }
    return `Bài ${l.lesson_number}. ${title}`;
  };

  return (
    <div className="config-block-card">
      <div className="config-block-header">
        <span className="config-block-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Nhóm câu hỏi #{index + 1}
        </span>
        {canDelete && (
          <button
            type="button"
            className="btn-icon-delete"
            onClick={onDelete}
            title="Xóa nhóm câu hỏi này"
            aria-label="Xóa nhóm câu hỏi"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      {/* Select Lessons Multi-Select */}
      <div className="form-group margin-bottom-sm">
        <label>
          Bài học <span style={{ color: "var(--danger)" }}>*</span>
        </label>
        <div className="multi-select-container" ref={dropdownRef}>
          <div
            className={`multi-select-trigger ${isOpen ? "open" : ""}`}
            onClick={() => !isLoadingLessons && availableLessons.length > 0 && setIsOpen(!isOpen)}
          >
            <div className="selected-chips">
              {isLoadingLessons ? (
                <span className="select-placeholder">Đang tải danh sách bài học...</span>
              ) : availableLessons.length === 0 ? (
                <span className="select-placeholder">Chưa chọn môn học hoặc không có bài học</span>
              ) : selectedLessons.length === 0 ? (
                <span className="select-placeholder">-- Chọn bài học --</span>
              ) : (
                selectedLessons.map((l) => (
                  <span key={l.id} className="chip-item">
                    <span>Bài {l.lesson_number}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={(e) => removeLesson(l.id, e)}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>
            <span className="dropdown-arrow">▼</span>
          </div>

          {isOpen && availableLessons.length > 0 && (
            <div className="multi-select-dropdown">
              <div className="dropdown-header-actions">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => onUpdate({ ...config, lessonIds: availableLessons.map((l) => l.id) })}
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => onUpdate({ ...config, lessonIds: [] })}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
              <div className="dropdown-options-list">
                {availableLessons.map((l) => {
                  const isChecked = (config.lessonIds || []).includes(l.id);
                  return (
                    <label key={l.id} className={`dropdown-option-item ${isChecked ? "selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLesson(l.id)}
                      />
                      <span className="option-label">
                        {formatLessonTitle(l)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="config-block-grid">
        {/* 1. Số lượng câu hỏi */}
        <div className="form-group">
          <label htmlFor={`count-${config.id}`}>Số lượng câu hỏi</label>
          <input
            id={`count-${config.id}`}
            type="number"
            min="1"
            max="50"
            value={config.count}
            onChange={(e) => {
              const val = Math.max(1, parseInt(e.target.value) || 1);
              onUpdate({ ...config, count: val });
            }}
          />
        </div>

        {/* 2. Độ khó */}
        <div className="form-group">
          <label htmlFor={`difficulty-${config.id}`}>Độ khó</label>
          <select
            id={`difficulty-${config.id}`}
            className="custom-select"
            value={config.difficulty}
            onChange={(e) =>
              onUpdate({
                ...config,
                difficulty: e.target.value as "easy" | "medium" | "hard",
              })
            }
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>

        {/* 3. Loại câu hỏi */}
        <div className="form-group">
          <label htmlFor={`type-${config.id}`}>Loại câu hỏi</label>
          <select
            id={`type-${config.id}`}
            className="custom-select"
            value={config.type}
            onChange={(e) =>
              onUpdate({
                ...config,
                type: e.target.value as "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
              })
            }
          >
            <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
            <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
          </select>
        </div>
      </div>
    </div>
  );
};

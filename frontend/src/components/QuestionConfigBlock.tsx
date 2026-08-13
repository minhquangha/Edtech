import React from "react";
import type { QuestionGroupConfig } from "../types";

interface QuestionConfigBlockProps {
  config: QuestionGroupConfig;
  index: number;
  canDelete: boolean;
  onUpdate: (updated: QuestionGroupConfig) => void;
  onDelete: () => void;
}

export const QuestionConfigBlock: React.FC<QuestionConfigBlockProps> = ({
  config,
  index,
  canDelete,
  onUpdate,
  onDelete,
}) => {
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
            title="Xóa cấu hình này"
            aria-label="Xóa nhóm câu hỏi"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
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

        {/* 2. Độ khó (Đúng 3 lựa chọn: Dễ, Trung bình, Khó) */}
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

        {/* 3. Loại câu hỏi (Đúng 2 lựa chọn: Trắc nghiệm 1 đáp án, Trắc nghiệm nhiều đáp án) */}
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

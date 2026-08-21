import React, { useState, useEffect, useCallback } from "react";
import type { Assignment } from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AssignmentDetailModal } from "./AssignmentDetailModal";
import { PrintablePreview } from "./PrintablePreview";

interface AssignmentListProps {
  onCreateNewClick: () => void;
  refreshTrigger: number;
}

const formatClassLevel = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "Lớp --";
  const str = String(val).trim();
  if (!str) return "Lớp --";
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
};

export const AssignmentList: React.FC<AssignmentListProps> = ({
  onCreateNewClick,
  refreshTrigger,
}) => {
  const { token } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected assignment for Detail Modal
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Print preview state
  const [printAssignment, setPrintAssignment] = useState<Assignment | null>(null);
  const [printShowAnswers, setPrintShowAnswers] = useState<boolean>(false);

  const fetchAssignments = useCallback(async () => {//chỉ chạy khi dc gọi và hàm sẽ thay đổi khi token thay đổi
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAssignments(token);
      setAssignments(res.data || []);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Không thể tải danh sách bài tập từ máy chủ");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments, refreshTrigger]);

  const handleViewDetail = async (id: number) => {
    if (!token) return;
    setIsDetailLoading(true);
    try {
      const res = await api.getAssignmentById(id, token);
      setSelectedAssignment(res.data);
    } catch (err: unknown) {
      alert((err as Error).message || "Không thể tải chi tiết bài tập");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài tập này không?")) return;

    setDeletingId(id);
    try {
      await api.deleteAssignment(id, token);
      setAssignments((prev) => prev.filter((a) => a?.id !== id));
    } catch (err: unknown) {
      alert((err as Error).message || "Không thể xóa bài tập");
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch full detail (with questions+answers) then open print preview
  const handlePrintPreview = async (id: number, showAnswers: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const res = await api.getAssignmentById(id, token);
      setPrintShowAnswers(showAnswers);
      setPrintAssignment(res.data);
    } catch (err: unknown) {
      alert((err as Error).message || "Không thể tải chi tiết bài tập để in");
    }
  };

  const filteredAssignments = (assignments || []).filter((item) => {
    if (!item) return false;
    const q = searchQuery.toLowerCase();
    const title = String(item.title || "").toLowerCase();
    const subject = String(item.subject || "").toLowerCase();
    const classLevel = String(item.class_level || "").toLowerCase();
    return (
      title.includes(q) ||
      subject.includes(q) ||
      classLevel.includes(q)
    );
  });

  return (
    <div className="dashboard-content">
      {/* Search & Actions Bar */}
      <div className="dashboard-toolbar">
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm bài tập theo tên, môn học, lớp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        <div className="toolbar-stats">
          <span className="stats-badge">
            Tổng cộng: <strong>{(assignments || []).length}</strong> bài tập
          </span>
          <button className="btn-secondary btn-icon" onClick={fetchAssignments} title="Tải lại">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="state-card loading-card">
          <span className="spinner spinner-large"></span>
          <p>Đang tải danh sách bài tập từ máy chủ...</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && errorMsg && (
        <div className="state-card error-card">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Không thể kết nối API</h3>
          <p>{errorMsg}</p>
          <button className="btn-primary" onClick={fetchAssignments}>
            Thử lại
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMsg && (assignments || []).length === 0 && (
        <div className="state-card empty-card">
          <div className="empty-icon">📚</div>
          <h3>Chưa có bài tập nào</h3>
          <p>Bạn chưa tạo bài tập nào. Hãy bấm nút dưới đây để tạo bài tập bằng AI trong vài giây!</p>
          <button className="btn-primary" onClick={onCreateNewClick}>
            ✨ Tạo bài tập đầu tiên
          </button>
        </div>
      )}

      {/* Assignments Grid */}
      {!isLoading && !errorMsg && filteredAssignments.length > 0 && (
        <div className="assignments-grid">
          {filteredAssignments.map((assignment) => {
            if (!assignment) return null;

            return (
              <div
                key={assignment.id}
                className="assignment-card"
                onClick={() => handleViewDetail(assignment.id)}
              >
                <div className="card-header-tags">
                  <span className="badge-tag">{formatClassLevel(assignment.class_level)}</span>
                  <span className="badge-tag">{assignment.subject || "Chưa phân loại"}</span>
                  <span className="badge-tag tag-duration">{assignment.duration_minutes || 0} Phút</span>
                </div>

                <h3 className="card-title">{assignment.title || "Bài tập không tên"}</h3>

                {assignment.description && (
                  <p className="card-description">{assignment.description}</p>
                )}

                <div className="card-footer">
                  <span className="card-hint">Click để xem câu hỏi & đáp án</span>
                  <div className="card-action-btns">
                    <button
                      type="button"
                      className="btn-card-icon"
                      onClick={(e) => handlePrintPreview(assignment.id, false, e)}
                      title="Xem trước & in đề thi (không có đáp án)"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-icon"
                      onClick={(e) => handlePrintPreview(assignment.id, true, e)}
                      title="Xem trước & in đề + đáp án"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                        <line x1="9" y1="11" x2="15" y2="11" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-card-icon btn-card-danger"
                      onClick={(e) => handleDelete(assignment.id, e)}
                      disabled={deletingId === assignment.id}
                      title="Xóa bài tập"
                    >
                      {deletingId === assignment.id ? (
                        <span className="spinner"></span>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter No Results State */}
      {!isLoading && !errorMsg && (assignments || []).length > 0 && filteredAssignments.length === 0 && (
        <div className="state-card empty-card">
          <p>Không tìm thấy bài tập nào phù hợp với từ khóa "<strong>{searchQuery}</strong>"</p>
          <button className="btn-secondary" onClick={() => setSearchQuery("")}>
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      )}

      {/* Assignment Detail Modal */}
      {selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onSuccess={fetchAssignments}
        />
      )}

      {/* Print Preview Modal */}
      {printAssignment && (
        <PrintablePreview
          assignment={printAssignment}
          showAnswers={printShowAnswers}
          onClose={() => setPrintAssignment(null)}
        />
      )}

      {isDetailLoading && (
        <div className="modal-backdrop">
          <div className="state-card loading-card">
            <span className="spinner spinner-large"></span>
            <p>Đang tải câu hỏi bài tập...</p>
          </div>
        </div>
      )}
    </div>
  );
};

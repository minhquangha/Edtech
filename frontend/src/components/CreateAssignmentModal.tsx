import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { QuestionGroupConfig, AssignmentRequest, Subject, Lesson, AiRequest, QuestionType } from "../types";
import { QuestionConfigBlock } from "./QuestionConfigBlock";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { PrintablePreview } from "./PrintablePreview";

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillData?: AssignmentRequest | null;
}

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

const formatClassLevel = (val: any): string => {
  if (val === null || val === undefined) return "Lớp --";
  const str = String(val).trim();
  if (!str) return "Lớp --";
  return str.startsWith("Lớp") ? str : `Lớp ${str}`;
};

const CLASS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  label: `Lớp ${i + 1}`,
  value: `${i + 1}`,
}));

const LEVEL_LABELS = {
  NB: "Nhận biết",
  TH: "Thông hiểu",
  VD: "Vận dụng",
} as const;

export const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  prefillData,
}) => {
  const { token } = useAuth();

  const [classLevel, setClassLevel] = useState("12");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>("");
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);

  const [configs, setConfigs] = useState<QuestionGroupConfig[]>([
    {
      id: "config-1",
      count: 5,
      lessonIds: [],
      difficulty: "TH",
      type: "SINGLE_CHOICE",
    },
  ]);

  const [step, setStep] = useState<"config" | "review">("config");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [generatedAssignment, setGeneratedAssignment] = useState<AssignmentRequest | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [printShowAnswers, setPrintShowAnswers] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && prefillData) {
      setGeneratedAssignment(prefillData);
      setStep("review");
    }
  }, [isOpen, prefillData]);

  const fetchSubjects = useCallback(async (gradeId: string) => {
    setIsLoadingSubjects(true);
    try {
      const data = await api.getSubjects(gradeId, token);
      setSubjects(data);
    } catch (err: any) {
      console.error("Lỗi khi lấy danh sách môn học:", err);
      setSubjects([]);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [token]);

  const fetchLessons = useCallback(async (gradeId: string, subjectId: number) => {
    setIsLoadingLessons(true);
    try {
      const data = await api.getLessons(gradeId, subjectId, token);
      setLessons(data);
    } catch (err: any) {
      console.error("Lỗi khi lấy danh sách bài học:", err);
      setLessons([]);
    } finally {
      setIsLoadingLessons(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchSubjects(classLevel);
    }
  }, [isOpen, classLevel, fetchSubjects]);

  const handleGradeChange = (newGrade: string) => {
    setClassLevel(newGrade);
    setSelectedSubjectId(null);
    setSelectedSubjectCode("");
    setSubjects([]);
    setLessons([]);
    setConfigs((prev) => prev.map((c) => ({ ...c, lessonIds: [] })));
    fetchSubjects(newGrade);
  };

  const handleSubjectChange = (subjectIdStr: string) => {
    if (!subjectIdStr) {
      setSelectedSubjectId(null);
      setSelectedSubjectCode("");
      setLessons([]);
      setConfigs((prev) => prev.map((c) => ({ ...c, lessonIds: [] })));
      return;
    }

    const subId = Number(subjectIdStr);
    const foundSub = subjects.find((s) => s.id === subId);
    if (foundSub) {
      setSelectedSubjectId(foundSub.id);
      setSelectedSubjectCode(foundSub.subject);
      setLessons([]);
      setConfigs((prev) => prev.map((c) => ({ ...c, lessonIds: [] })));
      fetchLessons(classLevel, foundSub.id);
    }
  };

  const totalQuestions = useMemo(() => {
    return configs.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  }, [configs]);

  const levelSummary = useMemo(() => {
    return configs.reduce<Record<"NB" | "TH" | "VD", number>>((acc, item) => {
      acc[item.difficulty] += Number(item.count) || 0;
      return acc;
    }, { NB: 0, TH: 0, VD: 0 });
  }, [configs]);

  const generatedLevelSummary = useMemo(() => {
    return (generatedAssignment?.questions || []).reduce<Record<"NB" | "TH" | "VD", number>>((acc, q: any) => {
      const level = q.cognitive_level === "NB" || q.cognitive_level === "TH" || q.cognitive_level === "VD" ? q.cognitive_level : "TH";
      acc[level] += 1;
      return acc;
    }, { NB: 0, TH: 0, VD: 0 });
  }, [generatedAssignment]);

  if (!isOpen) return null;

  const handleAddConfig = () => {
    const newConfig: QuestionGroupConfig = {
      id: `config-${Date.now()}`,
      count: 5,
      lessonIds: [],
      difficulty: "TH",
      type: "SINGLE_CHOICE",
    };
    setConfigs([...configs, newConfig]);
  };

  const handleUpdateConfig = (index: number, updated: QuestionGroupConfig) => {
    const next = [...configs];
    next[index] = updated;
    setConfigs(next);
  };

  const handleDeleteConfig = (index: number) => {
    if (configs.length <= 1) return;
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!classLevel) {
      setErrorMsg("Vui lòng chọn lớp học");
      return;
    }
    if (!selectedSubjectCode || selectedSubjectId === null) {
      setErrorMsg("Vui lòng chọn môn học");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên bài tập");
      return;
    }
    if (configs.length === 0) {
      setErrorMsg("Vui lòng thêm ít nhất một nhóm câu hỏi");
      return;
    }

    for (let i = 0; i < configs.length; i++) {
      const conf = configs[i];
      if (!conf.count || conf.count <= 0) {
        setErrorMsg(`Nhóm câu hỏi #${i + 1} phải có số lượng câu hỏi lớn hơn 0`);
        return;
      }
      if (!conf.lessonIds || conf.lessonIds.length === 0) {
        setErrorMsg(`Nhóm câu hỏi #${i + 1} chưa chọn bài học nào`);
        return;
      }
      if (!conf.difficulty) {
        setErrorMsg(`Nhóm câu hỏi #${i + 1} chưa chọn mức độ nhận thức`);
        return;
      }
      if (!conf.type) {
        setErrorMsg(`Nhóm câu hỏi #${i + 1} chưa chọn loại câu hỏi`);
        return;
      }
    }

    if (totalQuestions <= 0) {
      setErrorMsg("Tổng số câu hỏi phải lớn hơn 0");
      return;
    }

    setIsAiGenerating(true);

    try {
      const payload: AiRequest = {
        data: {
          class_level: classLevel,
          subject: selectedSubjectCode,
          title: title.trim(),
          description: description.trim(),
          time_duration: durationMinutes,
          question_config: {
            groups: configs.map((c) => ({
              count: Number(c.count),
              lessonIds: c.lessonIds,
              difficulty: c.difficulty,
              type: c.type,
            })),
          },
        },
      };

      const result = await api.generateAiAssignment(payload);
      const rawData = result.data;
      const normalizedQuestions = (rawData.questions || []).map((q: any) => {
        const qType: QuestionType = q.question_type || q.type || "SINGLE_CHOICE";
        let answerVal = q.answer !== undefined && q.answer !== null ? String(q.answer) : "";
        const cognitiveLevel = q.cognitive_level || "TH";

        if (qType === "TRUE_FALSE") {
          if (answerVal !== "true" && answerVal !== "false") {
            const correctAns = (q.answers || []).find((a: any) => a.isCorrect);
            if (correctAns) {
              answerVal = /đúng|true|1/i.test(correctAns.content) ? "true" : "false";
            } else {
              answerVal = "true";
            }
          }
        } else if (qType === "SHORT_ANSWER") {
          if (!answerVal && q.answers && q.answers.length > 0) {
            answerVal = q.answers[0].content || "";
          }
        }

        return {
          content: q.content || "",
          question_type: qType,
          cognitive_level: cognitiveLevel,
          answer: answerVal,
          answers: (q.answers || []).map((a: any) => ({
            content: a.content || "",
            isCorrect: Boolean(a.isCorrect),
          })),
        };
      });

      setGeneratedAssignment({
        ...rawData,
        questions: normalizedQuestions,
      });
      setStep("review");
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tạo bài tập bằng AI. Vui lòng thử lại!");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!generatedAssignment || !token) return;

    for (let i = 0; i < generatedAssignment.questions.length; i++) {
      const q = generatedAssignment.questions[i];
      const qNum = i + 1;
      if (!q.content.trim()) {
        setErrorMsg(`Câu ${qNum} không được để trống nội dung`);
        return;
      }

      if (q.question_type === "SINGLE_CHOICE") {
        if (!q.answers || q.answers.length === 0) {
          setErrorMsg(`Câu ${qNum} phải có ít nhất 1 lựa chọn`);
          return;
        }
        const correctCount = q.answers.filter((a: any) => a.isCorrect).length;
        if (correctCount !== 1) {
          setErrorMsg(`Câu ${qNum} (Một đáp án) phải chọn đúng 1 đáp án đúng`);
          return;
        }
      } else if (q.question_type === "MULTIPLE_CHOICE") {
        if (!q.answers || q.answers.length === 0) {
          setErrorMsg(`Câu ${qNum} phải có ít nhất 1 lựa chọn`);
          return;
        }
        const correctCount = q.answers.filter((a: any) => a.isCorrect).length;
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
      const assignmentToSave: AssignmentRequest = {
        ...generatedAssignment,
        questions: generatedAssignment.questions.map((q: any) => {
          const qType: QuestionType = q.question_type || "SINGLE_CHOICE";
          if (qType === "TRUE_FALSE") {
            return { content: q.content, question_type: qType, answer: q.answer || "true", answers: [], cognitive_level: q.cognitive_level } as any;
          }
          if (qType === "SHORT_ANSWER") {
            return { content: q.content, question_type: qType, answer: q.answer ? q.answer.trim() : "", answers: [], cognitive_level: q.cognitive_level } as any;
          }
          return {
            content: q.content,
            question_type: qType,
            answers: (q.answers || []).map((a: any) => ({ content: a.content, isCorrect: Boolean(a.isCorrect) })),
            cognitive_level: q.cognitive_level,
          } as any;
        }),
      };

      await api.createAssignment(assignmentToSave, token);
      onSuccess();
      handleResetAndClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi lưu bài tập xuống cơ sở dữ liệu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAndClose = () => {
    setStep("config");
    setGeneratedAssignment(null);
    setErrorMsg(null);
    setSelectedSubjectId(null);
    setSelectedSubjectCode("");
    setSubjects([]);
    setLessons([]);
    setTitle("");
    setDescription("");
    setClassLevel("12");
    setDurationMinutes(15);
    setConfigs([
      {
        id: "config-1",
        count: 5,
        lessonIds: [],
        difficulty: "TH",
        type: "SINGLE_CHOICE",
      },
    ]);
    onClose();
  };

  const handleQuestionContentChange = (qIndex: number, newContent: string) => {
    if (!generatedAssignment) return;
    const updatedQuestions = [...generatedAssignment.questions];
    updatedQuestions[qIndex].content = newContent;
    setGeneratedAssignment({ ...generatedAssignment, questions: updatedQuestions });
  };

  const handleAnswerContentChange = (qIndex: number, aIndex: number, newContent: string) => {
    if (!generatedAssignment) return;
    const updatedQuestions = [...generatedAssignment.questions];
    if (updatedQuestions[qIndex].answers) {
      updatedQuestions[qIndex].answers[aIndex].content = newContent;
      setGeneratedAssignment({ ...generatedAssignment, questions: updatedQuestions });
    }
  };

  const handleCorrectAnswerToggle = (qIndex: number, aIndex: number) => {
    if (!generatedAssignment) return;
    const updatedQuestions = [...generatedAssignment.questions];
    const question = updatedQuestions[qIndex];
    if (!question.answers) return;

    if (question.question_type === "SINGLE_CHOICE") {
      question.answers.forEach((ans: any, idx: number) => {
        ans.isCorrect = idx === aIndex;
      });
    } else {
      question.answers[aIndex].isCorrect = !question.answers[aIndex].isCorrect;
    }

    setGeneratedAssignment({ ...generatedAssignment, questions: updatedQuestions });
  };

  const handleTrueFalseChange = (qIndex: number, val: "true" | "false") => {
    if (!generatedAssignment) return;
    const updatedQuestions = [...generatedAssignment.questions];
    updatedQuestions[qIndex].answer = val;
    setGeneratedAssignment({ ...generatedAssignment, questions: updatedQuestions });
  };

  const handleShortAnswerChange = (qIndex: number, val: string) => {
    if (!generatedAssignment) return;
    const updatedQuestions = [...generatedAssignment.questions];
    updatedQuestions[qIndex].answer = val;
    setGeneratedAssignment({ ...generatedAssignment, questions: updatedQuestions });
  };

  return (
    <div className="modal-backdrop">
      <div className={`modal-container ${step === "review" ? "modal-large" : ""}`}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h3>
              {step === "config" ? (
                <>
                  <span className="sparkle-icon">✨</span> Tạo Bài Tập Mới Bằng AI
                </>
              ) : (
                <>
                  <span className="sparkle-icon">📋</span> Xem Trực Quan & Chỉnh Sửa Đề Thi
                </>
              )}
            </h3>
            <p className="modal-subtitle">
              {step === "config"
                ? "Điền thông tin và cấu hình câu hỏi để Gemini AI sinh đề thi"
                : "Kiểm tra lại câu hỏi trước khi bấm xác nhận lưu xuống cơ sở dữ liệu"}
            </p>
          </div>
          <button className="btn-close" onClick={handleResetAndClose} disabled={isAiGenerating || isSaving}>✕</button>
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

        {step === "config" && (
          <form onSubmit={handleGenerateAi} className="modal-body">
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="classLevel">Lớp học</label>
                <select id="classLevel" className="custom-select" value={classLevel} onChange={(e) => handleGradeChange(e.target.value)}>
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls.value} value={cls.value}>{cls.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Môn học</label>
                <select id="subject" className="custom-select" value={selectedSubjectId !== null ? selectedSubjectId : ""} onChange={(e) => handleSubjectChange(e.target.value)} disabled={isLoadingSubjects}>
                  <option value="">
                    {isLoadingSubjects ? "-- Đang tải danh sách môn... --" : subjects.length === 0 ? "-- Không tìm thấy môn học --" : "-- Chọn môn học --"}
                  </option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.subject}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="title">Tên bài tập / Đề thi</label>
                <input id="title" type="text" placeholder="Nhập tên tiêu đề bài tập..." value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="durationMinutes">Thời gian làm bài (Phút)</label>
                <input id="durationMinutes" type="number" min="5" max="180" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)} />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Ghi chú / Mô tả (Không bắt buộc)</label>
              <textarea id="description" rows={2} placeholder="Mô tả chi tiết về bài kiểm tra..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="config-section">
              <div className="config-section-header">
                <div>
                  <h4>Cấu Hình Cấu Trúc Câu Hỏi</h4>
                  <span className="config-hint">Thêm các nhóm câu hỏi theo số lượng, bài học, mức độ nhận thức và định dạng</span>
                </div>
                <div className="detail-badges">
                  <span className="badge-tag">NB: {levelSummary.NB}</span>
                  <span className="badge-tag">TH: {levelSummary.TH}</span>
                  <span className="badge-tag">VD: {levelSummary.VD}</span>
                </div>
              </div>

              <div className="config-blocks-list">
                {configs.map((conf, index) => (
                  <QuestionConfigBlock key={conf.id} config={conf} index={index} canDelete={configs.length > 1} availableLessons={lessons} isLoadingLessons={isLoadingLessons} onUpdate={(updated) => handleUpdateConfig(index, updated)} onDelete={() => handleDeleteConfig(index)} />
                ))}
              </div>

              <button type="button" className="btn-secondary add-config-btn" onClick={handleAddConfig}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>+ Thêm nhóm</span>
              </button>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={handleResetAndClose} disabled={isAiGenerating}>Hủy bỏ</button>
              <button type="submit" className="btn-primary btn-ai-generate" disabled={isAiGenerating || totalQuestions <= 0}>
                {isAiGenerating ? (
                  <span className="spinner-container"><span className="spinner"></span><span>AI Gemini đang tạo bài tập ({totalQuestions} câu)...</span></span>
                ) : (
                  <span>✨ Tạo bài tập với AI</span>
                )}
              </button>
            </div>
          </form>
        )}

        {step === "review" && generatedAssignment && (
          <div className="modal-body review-body">
            <div className="review-banner">
              <div className="banner-info">
                <span className="badge-tag">{formatClassLevel(generatedAssignment.class_level)}</span>
                <span className="badge-tag">{generatedAssignment.subject}</span>
                <span className="badge-tag">{generatedAssignment.duration_minutes} Phút</span>
                <span className="badge-tag tag-success">{generatedAssignment.questions.length} Câu hỏi</span>
              </div>
              <div className="detail-badges">
                <span className="badge-tag">NB: {generatedLevelSummary.NB}</span>
                <span className="badge-tag">TH: {generatedLevelSummary.TH}</span>
                <span className="badge-tag">VD: {generatedLevelSummary.VD}</span>
              </div>
              <p className="banner-note">💡 AI đã tạo xong đề thi bên dưới! Bạn có thể trực tiếp chỉnh sửa nội dung hoặc đáp án trước khi bấm <strong>Xác nhận & Lưu</strong>.</p>
            </div>

            <div className="review-questions-list">
              {generatedAssignment.questions.map((q, qIndex) => (
                <div key={qIndex} className="question-review-card">
                  <div className="question-review-header">
                    <span className="q-number">Câu {qIndex + 1}:</span>
                    <span className={`q-type-badge ${getQuestionTypeBadgeClass(q.question_type)}`}>{getQuestionTypeLabel(q.question_type)}</span>
                    <span className="badge-tag" style={{ marginLeft: "auto" }}>{LEVEL_LABELS[(q as any).cognitive_level || "TH"]}</span>
                  </div>

                  <div className="form-group">
                    <input type="text" className="question-input" value={q.content} onChange={(e) => handleQuestionContentChange(qIndex, e.target.value)} />
                  </div>

                  {(q.question_type === "SINGLE_CHOICE" || q.question_type === "MULTIPLE_CHOICE") && (
                    <div className="answers-review-grid">
                      {q.answers && q.answers.map((ans: any, aIndex: number) => (
                        <div key={aIndex} className={`answer-option-row ${ans.isCorrect ? "is-correct" : ""}`}>
                          <button type="button" className={`btn-check-correct ${ans.isCorrect ? "checked" : ""}`} onClick={() => handleCorrectAnswerToggle(qIndex, aIndex)} title={ans.isCorrect ? "Đáp án đúng" : "Đánh dấu là đáp án đúng"}>{ans.isCorrect ? "✓" : ""}</button>
                          <input type="text" className="answer-input" value={ans.content} onChange={(e) => handleAnswerContentChange(qIndex, aIndex, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}

                  {q.question_type === "TRUE_FALSE" && (
                    <div className="tf-options-group">
                      <button type="button" className={`tf-btn ${q.answer === "true" ? "selected" : ""}`} onClick={() => handleTrueFalseChange(qIndex, "true")}>{q.answer === "true" ? "✓ " : "○ "}Đúng</button>
                      <button type="button" className={`tf-btn ${q.answer === "false" ? "selected" : ""}`} onClick={() => handleTrueFalseChange(qIndex, "false")}>{q.answer === "false" ? "✓ " : "○ "}Sai</button>
                    </div>
                  )}

                  {q.question_type === "SHORT_ANSWER" && (
                    <div className="short-answer-input-group">
                      <label className="short-answer-label">Đáp án đúng:</label>
                      <input type="text" className="answer-input" placeholder="Nhập đáp án đúng..." value={q.answer || ""} onChange={(e) => handleShortAnswerChange(qIndex, e.target.value)} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setStep("config")} disabled={isSaving}>← Cấu hình lại</button>
              <button type="button" className="btn-secondary" onClick={() => { setPrintShowAnswers(false); setShowPrintPreview(true); }} title="Xem trước & in đề (không đáp án)">In đề</button>
              <button type="button" className="btn-secondary" onClick={() => { setPrintShowAnswers(true); setShowPrintPreview(true); }} title="Xem trước & in đề + đáp án">In đề + đáp án</button>
              <button type="button" className="btn-primary btn-save" onClick={handleSaveAssignment} disabled={isSaving}>
                {isSaving ? (
                  <span className="spinner-container"><span className="spinner"></span><span>Đang lưu vào CSDL...</span></span>
                ) : (
                  <span>💾 Xác nhận & Lưu bài tập</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showPrintPreview && generatedAssignment && (
        <PrintablePreview assignment={generatedAssignment as any} showAnswers={printShowAnswers} onClose={() => setShowPrintPreview(false)} />
      )}
    </div>
  );
};

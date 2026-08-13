import { useEffect, useMemo, useState } from 'react'
import './App.css'

type QuestionType = 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE'

type Answer = {
  id: number
  questionId: number
  content: string
  isCorrect: boolean
}

type Question = {
  id: number
  assignmentId: number
  content: string
  question_type: QuestionType
  answers: Answer[]
}

type Assignment = {
  id: number
  title: string
  description?: string
  class_level: string
  subject: string
  duration_minutes: number
  teacher_id: number
  questions: Question[]
}

type AIFormState = {
  title: string
  description: string
  subject: string
  classLevel: string
  durationMinutes: string
  questionCount: string
  questionType: QuestionType
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  extraRequirements: string
}

type Screen = 'list' | 'generate' | 'review' | 'detail' | 'edit'

type DraftQuestion = {
  id: number
  content: string
  question_type: QuestionType
  answers: {
    id: number
    content: string
    isCorrect: boolean
  }[]
}

type DraftAssignment = {
  title: string
  description: string
  class_level: string
  duration_minutes: number
  subject: string
  questions: DraftQuestion[]
}

type ToastState = {
  type: 'success' | 'info'
  message: string
} | null

const STORAGE_KEY = 'edtech-demo-assignments-v1'
const CURRENT_TEACHER_ID = 1001

const DEFAULT_AI_FORM: AIFormState = {
  title: 'Bài tập Toán lớp 6 - Số nguyên',
  description: 'Tạo bài tập luyện tập phù hợp cho giờ kiểm tra nhanh trên lớp.',
  subject: 'Toán học',
  classLevel: 'Lớp 6',
  durationMinutes: '25',
  questionCount: '5',
  questionType: 'SINGLE_CHOICE',
  topic: 'Số nguyên và phép tính cơ bản',
  difficulty: 'medium',
  extraRequirements: 'Câu hỏi ngắn gọn, rõ ràng, có 4 phương án mỗi câu.',
}

function createAnswer(id: number, questionId: number, content: string, isCorrect = false): Answer {
  return { id, questionId, content, isCorrect }
}

function createQuestion(
  id: number,
  assignmentId: number,
  content: string,
  question_type: QuestionType,
  answers: Answer[],
): Question {
  return { id, assignmentId, content, question_type, answers }
}

function seedAssignments(): Assignment[] {
  return [
    {
      id: 1,
      title: 'Ôn tập Toán 6 - Số nguyên',
      description: 'Bài tập ngắn dùng để kiểm tra mức độ nắm bài trên lớp.',
      class_level: 'Lớp 6',
      subject: 'Toán học',
      duration_minutes: 20,
      teacher_id: CURRENT_TEACHER_ID,
      questions: [
        createQuestion(11, 1, 'Số nguyên nào sau đây là số âm?', 'SINGLE_CHOICE', [
          createAnswer(111, 11, '7', false),
          createAnswer(112, 11, '-3', true),
          createAnswer(113, 11, '0', false),
          createAnswer(114, 11, '12', false),
        ]),
        createQuestion(12, 1, 'Trong các số sau, số nào lớn hơn 0?', 'SINGLE_CHOICE', [
          createAnswer(121, 12, '-9', false),
          createAnswer(122, 12, '0', false),
          createAnswer(123, 12, '5', true),
          createAnswer(124, 12, '-1', false),
        ]),
      ],
    },
    {
      id: 2,
      title: 'Khoa học tự nhiên - Sinh vật và môi trường',
      description: 'Bài tập kiểm tra kiến thức nền tảng về hệ sinh thái.',
      class_level: 'Lớp 7',
      subject: 'Khoa học',
      duration_minutes: 30,
      teacher_id: CURRENT_TEACHER_ID,
      questions: [
        createQuestion(21, 2, 'Chọn các yếu tố vô sinh trong môi trường.', 'MULTIPLE_CHOICE', [
          createAnswer(211, 21, 'Ánh sáng', true),
          createAnswer(212, 21, 'Cây xanh', false),
          createAnswer(213, 21, 'Nhiệt độ', true),
          createAnswer(214, 21, 'Vi sinh vật', false),
        ]),
        createQuestion(22, 2, 'Một quần xã sinh vật là gì?', 'SINGLE_CHOICE', [
          createAnswer(221, 22, 'Tập hợp các cá thể cùng loài sống trong cùng khu vực', false),
          createAnswer(222, 22, 'Tập hợp nhiều quần thể khác loài sống cùng khu vực', true),
          createAnswer(223, 22, 'Một cá thể sinh vật', false),
          createAnswer(224, 22, 'Toàn bộ sinh vật trên Trái Đất', false),
        ]),
      ],
    },
  ]
}

function loadAssignments(): Assignment[] {
  if (typeof window === 'undefined') {
    return seedAssignments()
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return seedAssignments()
  }

  try {
    const parsed = JSON.parse(raw) as Assignment[]
    return parsed.length > 0 ? parsed : seedAssignments()
  } catch {
    return seedAssignments()
  }
}

function getNewId(items: { id: number }[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

function createEmptyDraftQuestion(seedId: number): DraftQuestion {
  return {
    id: seedId,
    content: 'Câu hỏi mới',
    question_type: 'SINGLE_CHOICE',
    answers: [
      { id: seedId * 10 + 1, content: 'Phương án 1', isCorrect: true },
      { id: seedId * 10 + 2, content: 'Phương án 2', isCorrect: false },
      { id: seedId * 10 + 3, content: 'Phương án 3', isCorrect: false },
      { id: seedId * 10 + 4, content: 'Phương án 4', isCorrect: false },
    ],
  }
}

function assignmentToDraft(assignment: Assignment): DraftAssignment {
  return {
    title: assignment.title,
    description: assignment.description ?? '',
    class_level: assignment.class_level,
    duration_minutes: assignment.duration_minutes,
    subject: assignment.subject,
    questions: assignment.questions.map((question) => ({
      id: question.id,
      content: question.content,
      question_type: question.question_type,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
        isCorrect: answer.isCorrect,
      })),
    })),
  }
}

function draftToAssignment(
  draft: DraftAssignment,
  assignmentId: number,
  teacherId: number,
): Assignment {
  return {
    id: assignmentId,
    teacher_id: teacherId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    class_level: draft.class_level.trim(),
    subject: draft.subject.trim(),
    duration_minutes: Number(draft.duration_minutes),
    questions: draft.questions.map((question) => ({
      id: question.id,
      assignmentId,
      content: question.content.trim(),
      question_type: question.question_type,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        questionId: question.id,
        content: answer.content.trim(),
        isCorrect: answer.isCorrect,
      })),
    })),
  }
}

function generateAssignmentFromAI(form: AIFormState): DraftAssignment {
  const questionCount = Math.max(Number(form.questionCount) || 1, 1)
  const duration = Math.max(Number(form.durationMinutes) || 15, 5)
  const difficultyLabel =
    form.difficulty === 'easy' ? 'Dễ' : form.difficulty === 'medium' ? 'Trung bình' : 'Khó'
  const answerCount = form.questionType === 'SINGLE_CHOICE' ? 4 : 5

  const questions: DraftQuestion[] = Array.from({ length: questionCount }, (_, index) => {
    const questionId = 1000 + index + 1
    const answers = Array.from({ length: answerCount }, (_, answerIndex) => ({
      id: questionId * 10 + answerIndex + 1,
      content: `Phương án ${answerIndex + 1}`,
      isCorrect: answerIndex === 0,
    }))

    if (form.questionType === 'MULTIPLE_CHOICE') {
      answers[1].isCorrect = index % 2 === 0
    }

    return {
      id: questionId,
      content: `(${difficultyLabel}) Câu ${index + 1}: ${form.topic} - tình huống thực hành ${index + 1}`,
      question_type: form.questionType,
      answers,
    }
  })

  return {
    title: form.title.trim() || `Bài tập ${form.subject}`,
    description:
      `${form.description.trim()}\n\nChủ đề: ${form.topic}\nĐộ khó: ${difficultyLabel}\nYêu cầu thêm: ${form.extraRequirements}`.trim(),
    class_level: form.classLevel.trim(),
    duration_minutes: duration,
    subject: form.subject.trim(),
    questions,
  }
}

function cloneDraft(draft: DraftAssignment): DraftAssignment {
  return {
    title: draft.title,
    description: draft.description,
    class_level: draft.class_level,
    duration_minutes: draft.duration_minutes,
    subject: draft.subject,
    questions: draft.questions.map((question) => ({
      id: question.id,
      content: question.content,
      question_type: question.question_type,
      answers: question.answers.map((answer) => ({ ...answer })),
    })),
  }
}

function App() {
  const [assignments, setAssignments] = useState<Assignment[]>(loadAssignments)
  const [screen, setScreen] = useState<Screen>('list')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null)
  const [aiForm, setAiForm] = useState<AIFormState>(DEFAULT_AI_FORM)
  const [reviewDraft, setReviewDraft] = useState<DraftAssignment | null>(null)
  const [editorDraft, setEditorDraft] = useState<DraftAssignment | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  }, [assignments])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  )

  const totalQuestions = selectedAssignment?.questions.length ?? 0

  const goToList = () => {
    setSelectedAssignmentId(null)
    setReviewDraft(null)
    setEditorDraft(null)
    setScreen('list')
  }

  const handleGenerate = () => {
    setAiLoading(true)
    setTimeout(() => {
      const generated = generateAssignmentFromAI(aiForm)
      setReviewDraft(generated)
      setAiLoading(false)
      setScreen('review')
      setToast({ type: 'info', message: 'AI đã tạo xong bản nháp để giáo viên review.' })
    }, 1400)
  }

  const handleConfirmCreate = () => {
    if (!reviewDraft) return

    setSaving(true)
    setTimeout(() => {
      const nextId = getNewId(assignments)
      const created = draftToAssignment(reviewDraft, nextId, CURRENT_TEACHER_ID)
      setAssignments((current) => [created, ...current])
      setSelectedAssignmentId(created.id)
      setSaving(false)
      setReviewDraft(null)
      setScreen('detail')
      setToast({ type: 'success', message: 'Tạo assignment thành công.' })
    }, 900)
  }

  const handleOpenDetail = (assignment: Assignment) => {
    setSelectedAssignmentId(assignment.id)
    setScreen('detail')
  }

  const handleOpenEdit = () => {
    if (!selectedAssignment) return
    setEditorDraft(assignmentToDraft(selectedAssignment))
    setScreen('edit')
  }

  const handleSaveEdit = () => {
    if (!editorDraft || !selectedAssignment) return

    setSaving(true)
    setTimeout(() => {
      const updated = draftToAssignment(editorDraft, selectedAssignment.id, selectedAssignment.teacher_id)
      setAssignments((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedAssignmentId(updated.id)
      setSaving(false)
      setEditorDraft(null)
      setScreen('detail')
      setToast({ type: 'success', message: 'Cập nhật assignment thành công.' })
    }, 800)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return

    setSaving(true)
    setTimeout(() => {
      setAssignments((current) => current.filter((assignment) => assignment.id !== deleteTarget.id))
      setSaving(false)
      setDeleteTarget(null)
      setToast({ type: 'success', message: 'Đã xóa assignment.' })
      goToList()
    }, 700)
  }

  const updateDraftAssignment = (updater: (draft: DraftAssignment) => DraftAssignment) => {
    if (screen === 'review') {
      setReviewDraft((current) => (current ? updater(cloneDraft(current)) : current))
      return
    }

    if (screen === 'edit') {
      setEditorDraft((current) => (current ? updater(cloneDraft(current)) : current))
    }
  }

  const currentEditorDraft = screen === 'review' ? reviewDraft : editorDraft

  const assignmentCountText = `${assignments.length} bài tập`
  const questionCountText = `${assignments.reduce((sum, assignment) => sum + assignment.questions.length, 0)} câu hỏi`

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">EdTech Teacher Demo</p>
          <h1>Assignment Studio</h1>
          <p className="topbar-subtitle">
            Demo giao diện frontend cho luồng tạo, review, chỉnh sửa và quản lý bài tập.
          </p>
        </div>

        <div className="topbar-metrics">
          <Metric label="Assignments" value={assignmentCountText} />
          <Metric label="Questions" value={questionCountText} />
        </div>
      </header>

      <main className="content-card">
        {screen === 'list' && (
          <section className="section-stack">
            <div className="section-header">
              <div>
                <h2>Danh sách bài tập của giáo viên</h2>
                <p>Xem nhanh thông tin cơ bản và mở chi tiết từng assignment.</p>
              </div>

              <button className="primary-button" type="button" onClick={() => setScreen('generate')}>
                Tạo bài tập bằng AI
              </button>
            </div>

            <div className="assignment-grid">
              {assignments.map((assignment) => (
                <article key={assignment.id} className="assignment-card">
                  <div className="card-head">
                    <div>
                      <span className="badge">{assignment.subject}</span>
                      <h3>{assignment.title}</h3>
                    </div>
                    <span className="question-pill">{assignment.questions.length} câu hỏi</span>
                  </div>

                  <p className="muted-text">{assignment.description}</p>

                  <div className="meta-grid">
                    <Meta label="Class" value={assignment.class_level} />
                    <Meta label="Duration" value={`${assignment.duration_minutes} phút`} />
                    <Meta label="Questions" value={`${assignment.questions.length}`} />
                  </div>

                  <div className="card-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleOpenDetail(assignment)}
                    >
                      Xem chi tiết
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setSelectedAssignmentId(assignment.id)
                        handleOpenEdit()
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {screen === 'generate' && (
          <section className="section-stack">
            <div className="section-header">
              <div>
                <h2>Tạo bài tập bằng AI</h2>
                <p>Nhập yêu cầu để mô phỏng AI sinh ra bài tập mới.</p>
              </div>
              <button className="ghost-button" type="button" onClick={goToList}>
                Quay lại danh sách
              </button>
            </div>

            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                handleGenerate()
              }}
            >
              <Field label="Title">
                <input
                  value={aiForm.title}
                  onChange={(event) => setAiForm({ ...aiForm, title: event.target.value })}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={aiForm.description}
                  onChange={(event) => setAiForm({ ...aiForm, description: event.target.value })}
                />
              </Field>
              <Field label="Subject">
                <input
                  value={aiForm.subject}
                  onChange={(event) => setAiForm({ ...aiForm, subject: event.target.value })}
                />
              </Field>
              <Field label="Class level">
                <input
                  value={aiForm.classLevel}
                  onChange={(event) => setAiForm({ ...aiForm, classLevel: event.target.value })}
                />
              </Field>
              <Field label="Duration">
                <input
                  type="number"
                  min={5}
                  value={aiForm.durationMinutes}
                  onChange={(event) => setAiForm({ ...aiForm, durationMinutes: event.target.value })}
                />
              </Field>
              <Field label="Số lượng câu hỏi">
                <input
                  type="number"
                  min={1}
                  value={aiForm.questionCount}
                  onChange={(event) => setAiForm({ ...aiForm, questionCount: event.target.value })}
                />
              </Field>
              <Field label="Loại câu hỏi">
                <select
                  value={aiForm.questionType}
                  onChange={(event) =>
                    setAiForm({ ...aiForm, questionType: event.target.value as QuestionType })
                  }
                >
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                </select>
              </Field>
              <Field label="Chủ đề">
                <input
                  value={aiForm.topic}
                  onChange={(event) => setAiForm({ ...aiForm, topic: event.target.value })}
                />
              </Field>
              <Field label="Độ khó">
                <select
                  value={aiForm.difficulty}
                  onChange={(event) =>
                    setAiForm({
                      ...aiForm,
                      difficulty: event.target.value as AIFormState['difficulty'],
                    })
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
              <Field label="Yêu cầu thêm" fullWidth>
                <textarea
                  rows={3}
                  value={aiForm.extraRequirements}
                  onChange={(event) =>
                    setAiForm({ ...aiForm, extraRequirements: event.target.value })
                  }
                />
              </Field>

              <div className="form-actions full-width">
                <button className="primary-button" type="submit" disabled={aiLoading}>
                  {aiLoading ? 'Generating...' : 'Generate'}
                </button>
                <button className="ghost-button" type="button" onClick={goToList}>
                  Hủy
                </button>
              </div>
            </form>

            {aiLoading && (
              <div className="loading-panel">
                <div className="spinner" aria-hidden="true" />
                <div>
                  <h3>AI đang tạo bài tập...</h3>
                  <p>Đang mô phỏng thời gian sinh câu hỏi và đáp án phù hợp với yêu cầu.</p>
                </div>
              </div>
            )}
          </section>
        )}

        {screen === 'review' && currentEditorDraft && (
          <section className="section-stack">
            <div className="section-header">
              <div>
                <h2>Review bài tập do AI generate</h2>
                <p>Giáo viên có thể chỉnh sửa câu hỏi, option và đáp án đúng trước khi tạo.</p>
              </div>
              <button className="ghost-button" type="button" onClick={goToList}>
                Hủy review
              </button>
            </div>

            <AssignmentEditor
              draft={currentEditorDraft}
              setDraft={(updater) =>
                updateDraftAssignment((draft) => {
                  const next = updater(draft)
                  return next
                })
              }
              onAddQuestion={() => {
                updateDraftAssignment((draft) => ({
                  ...draft,
                  questions: [...draft.questions, createEmptyDraftQuestion(getNewId(draft.questions))],
                }))
              }}
              onConfirm={() => handleConfirmCreate()}
              onCancel={goToList}
              confirmLabel="Xác nhận & Tạo bài tập"
              saving={saving}
            />
          </section>
        )}

        {screen === 'detail' && selectedAssignment && (
          <section className="section-stack">
            <div className="section-header">
              <div>
                <h2>Chi tiết Assignment</h2>
                <p>Xem toàn bộ câu hỏi, option và đáp án đúng.</p>
              </div>
              <div className="section-actions">
                <button className="ghost-button" type="button" onClick={goToList}>
                  Quay lại
                </button>
                <button className="secondary-button" type="button" onClick={handleOpenEdit}>
                  Edit
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => setDeleteTarget(selectedAssignment)}
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="detail-hero">
              <div>
                <span className="badge">{selectedAssignment.subject}</span>
                <h3>{selectedAssignment.title}</h3>
                <p>{selectedAssignment.description}</p>
              </div>

              <div className="detail-stats">
                <Meta label="Class" value={selectedAssignment.class_level} />
                <Meta label="Duration" value={`${selectedAssignment.duration_minutes} phút`} />
                <Meta label="Questions" value={String(totalQuestions)} />
              </div>
            </div>

            <div className="question-list">
              {selectedAssignment.questions.map((question, index) => (
                <article key={question.id} className="question-card">
                  <div className="question-head">
                    <div>
                      <span className="question-index">Câu {index + 1}</span>
                      <h4>{question.content}</h4>
                    </div>
                    <span className="badge soft">{question.question_type}</span>
                  </div>

                  <div className="option-list">
                    {question.answers.map((answer) => (
                      <div key={answer.id} className={answer.isCorrect ? 'option-row correct' : 'option-row'}>
                        <span>{answer.content}</span>
                        {answer.isCorrect && <strong>Đáp án đúng</strong>}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {screen === 'edit' && currentEditorDraft && (
          <section className="section-stack">
            <div className="section-header">
              <div>
                <h2>Edit Assignment</h2>
                <p>Chỉnh sửa nội dung assignment và lưu lại dữ liệu trong local state.</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setScreen('detail')}>
                Hủy chỉnh sửa
              </button>
            </div>

            <AssignmentEditor
              draft={currentEditorDraft}
              setDraft={(updater) =>
                updateDraftAssignment((draft) => {
                  const next = updater(draft)
                  return next
                })
              }
              onAddQuestion={() => {
                updateDraftAssignment((draft) => ({
                  ...draft,
                  questions: [...draft.questions, createEmptyDraftQuestion(getNewId(draft.questions))],
                }))
              }}
              onConfirm={handleSaveEdit}
              onCancel={() => setScreen('detail')}
              confirmLabel="Lưu thay đổi"
              saving={saving}
            />
          </section>
        )}
      </main>

      {toast && <Toast toast={toast} />}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Xác nhận xóa Assignment</h3>
            <p>
              Bạn có chắc muốn xóa <strong>{deleteTarget.title}</strong> không? Hành động này sẽ xóa
              toàn bộ câu hỏi và đáp án liên quan.
            </p>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setDeleteTarget(null)}>
                Hủy
              </button>
              <button className="danger-button" type="button" onClick={confirmDelete} disabled={saving}>
                {saving ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AssignmentEditor({
  draft,
  setDraft,
  onAddQuestion,
  onConfirm,
  onCancel,
  confirmLabel,
  saving,
}: {
  draft: DraftAssignment
  setDraft: (updater: (current: DraftAssignment) => DraftAssignment) => void
  onAddQuestion: () => void
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  saving: boolean
}) {
  const updateDraft = (updater: (current: DraftAssignment) => DraftAssignment) => {
    setDraft(updater)
  }

  const updateQuestion = (questionIndex: number, updater: (question: DraftQuestion) => DraftQuestion) => {
    updateDraft((current) => ({
      ...current,
      questions: current.questions.map((question, index) => (index === questionIndex ? updater(question) : question)),
    }))
  }

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    updater: (answer: DraftQuestion['answers'][number]) => DraftQuestion['answers'][number],
  ) => {
    updateQuestion(questionIndex, (question) => ({
      ...question,
      answers: question.answers.map((answer, index) => (index === answerIndex ? updater(answer) : answer)),
    }))
  }

  const addAnswer = (questionIndex: number) => {
    updateQuestion(questionIndex, (question) => ({
      ...question,
      answers: [
        ...question.answers,
        {
          id: question.id * 10 + question.answers.length + 1,
          content: `Phương án ${question.answers.length + 1}`,
          isCorrect: false,
        },
      ],
    }))
  }

  const removeQuestion = (questionIndex: number) => {
    updateDraft((current) => ({
      ...current,
      questions: current.questions.filter((_, index) => index !== questionIndex),
    }))
  }

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    updateQuestion(questionIndex, (question) => {
      const nextAnswers = question.answers.filter((_, index) => index !== answerIndex)
      const hasCorrect = nextAnswers.some((answer) => answer.isCorrect)
      if (!hasCorrect && nextAnswers.length > 0) {
        nextAnswers[0] = { ...nextAnswers[0], isCorrect: true }
      }
      return {
        ...question,
        answers: nextAnswers,
      }
    })
  }

  return (
    <div className="editor-layout">
      <div className="editor-summary">
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={4}
            value={draft.description}
            onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
          />
        </Field>

        <div className="dual-field-grid">
          <Field label="Subject">
            <input
              value={draft.subject}
              onChange={(event) => updateDraft((current) => ({ ...current, subject: event.target.value }))}
            />
          </Field>
          <Field label="Class level">
            <input
              value={draft.class_level}
              onChange={(event) => updateDraft((current) => ({ ...current, class_level: event.target.value }))}
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              type="number"
              min={5}
              value={draft.duration_minutes}
              onChange={(event) =>
                updateDraft((current) => ({ ...current, duration_minutes: Number(event.target.value) }))
              }
            />
          </Field>
        </div>
      </div>

      <div className="questions-editor">
        <div className="questions-editor-header">
          <h3>Questions</h3>
          <button className="secondary-button" type="button" onClick={onAddQuestion}>
            + Thêm câu hỏi
          </button>
        </div>

        {draft.questions.map((question, questionIndex) => (
          <article key={question.id} className="question-editor-card">
            <div className="question-editor-top">
              <div>
                <span className="question-index">Câu {questionIndex + 1}</span>
                <p className="small-caption">Sửa nội dung câu hỏi, option và đáp án đúng ở đây.</p>
              </div>
              <button className="link-button danger-link" type="button" onClick={() => removeQuestion(questionIndex)}>
                Xóa câu hỏi
              </button>
            </div>

            <Field label="Question content">
              <textarea
                rows={2}
                value={question.content}
                onChange={(event) =>
                  updateQuestion(questionIndex, (current) => ({ ...current, content: event.target.value }))
                }
              />
            </Field>

            <div className="question-type-row">
              <Field label="Question type">
                <select
                  value={question.question_type}
                  onChange={(event) => {
                    const nextType = event.target.value as QuestionType
                    updateQuestion(questionIndex, (current) => {
                      const nextAnswers = current.answers.map((answer, index) => ({
                        ...answer,
                        isCorrect: nextType === 'SINGLE_CHOICE' ? index === 0 : answer.isCorrect,
                      }))
                      if (nextType === 'MULTIPLE_CHOICE' && !nextAnswers.some((answer) => answer.isCorrect)) {
                        nextAnswers[0] = { ...nextAnswers[0], isCorrect: true }
                      }
                      return { ...current, question_type: nextType, answers: nextAnswers }
                    })
                  }}
                >
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                </select>
              </Field>

              <div className="helper-note">
                {question.question_type === 'SINGLE_CHOICE'
                  ? 'Chọn một đáp án đúng.'
                  : 'Có thể chọn nhiều đáp án đúng.'}
              </div>
            </div>

            <div className="answer-list">
              {question.answers.map((answer, answerIndex) => (
                <div key={answer.id} className="answer-row">
                  <input
                    className="answer-input"
                    value={answer.content}
                    onChange={(event) =>
                      updateAnswer(questionIndex, answerIndex, (current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                  />

                  {question.question_type === 'SINGLE_CHOICE' ? (
                    <label className="correct-control">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={answer.isCorrect}
                        onChange={() => {
                          updateQuestion(questionIndex, (current) => ({
                            ...current,
                            answers: current.answers.map((item, index) => ({
                              ...item,
                              isCorrect: index === answerIndex,
                            })),
                          }))
                        }}
                      />
                      Đáp án đúng
                    </label>
                  ) : (
                    <label className="correct-control">
                      <input
                        type="checkbox"
                        checked={answer.isCorrect}
                        onChange={(event) =>
                          updateAnswer(questionIndex, answerIndex, (current) => ({
                            ...current,
                            isCorrect: event.target.checked,
                          }))
                        }
                      />
                      Đáp án đúng
                    </label>
                  )}

                  <button className="link-button danger-link" type="button" onClick={() => removeAnswer(questionIndex, answerIndex)}>
                    Xóa
                  </button>
                </div>
              ))}
            </div>

            <button className="secondary-button" type="button" onClick={() => addAnswer(questionIndex)}>
              + Thêm option
            </button>
          </article>
        ))}
      </div>

      <div className="editor-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>
          Hủy
        </button>
        <button className="primary-button" type="button" onClick={onConfirm} disabled={saving}>
          {saving ? 'Đang lưu...' : confirmLabel}
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  fullWidth = false,
}: {
  label: string
  children: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <label className={fullWidth ? 'field full-width' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Toast({ toast }: { toast: Exclude<ToastState, null> }) {
  return <div className={`toast ${toast.type}`}>{toast.message}</div>
}

export default App

import type {
  AuthResponse,
  RegisterResponse,
  AiRequest,
  AssignmentRequest,
  Assignment,
  AssignmentUpdateRequest,
  Subject,
  Lesson,
  CognitiveLevel
} from "../types";

// const API_BASE_URL = "/api";
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const getHeaders = (token?: string | null): HeadersInit => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || `Lỗi máy chủ (${response.status})`;
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  // Subjects & Lessons APIs
  getSubjects: async (gradeId: string | number, token?: string | null): Promise<Subject[]> => {
    let res = await fetch(`${API_BASE_URL}/assignments/subjects?gradeId=${gradeId}`, {
      method: "GET",
      headers: getHeaders(token),
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/assignment/subjects?gradeId=${gradeId}`, {
        method: "GET",
        headers: getHeaders(token),
      });
    }
    const data = await handleResponse<Subject[] | { data: Subject[] }>(res);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  },

  getLessons: async (gradeId: string | number, subjectId: number, token?: string | null): Promise<Lesson[]> => {
    let res = await fetch(`${API_BASE_URL}/assignments/lessons?gradeId=${gradeId}&subjectId=${subjectId}`, {
      method: "GET",
      headers: getHeaders(token),
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/assignment/lessons?gradeId=${gradeId}&subjectId=${subjectId}`, {
        method: "GET",
        headers: getHeaders(token),
      });
    }
    const data = await handleResponse<Lesson[] | { data: Lesson[] }>(res);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  },

  // Auth APIs
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await fetch(`${API_BASE_URL}/users/me/login`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: { username, password },
      }),
    });
    return handleResponse<AuthResponse>(res);
  },

  register: async (username: string, password: string): Promise<RegisterResponse> => {
    const res = await fetch(`${API_BASE_URL}/users/me/register`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        data: { username, password },
      }),
    });
    return handleResponse<RegisterResponse>(res);
  },

  // AI Generator API
  generateAiAssignment: async (payload: AiRequest): Promise<{ message: string; data: AssignmentRequest }> => {
    const res = await fetch(`${API_BASE_URL}/ai/create`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ message: string; data: AssignmentRequest }>(res);
  },

  // Assignment CRUD APIs
  createAssignment: async (
    assignment: AssignmentRequest,
    token: string
  ): Promise<{ message: string; data: Assignment }> => {
    const res = await fetch(`${API_BASE_URL}/assignments/create`, {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify(assignment),
    });
    return handleResponse<{ message: string; data: Assignment }>(res);
  },

  getAssignments: async (token: string): Promise<{ message: string; data: Assignment[] }> => {
    const res = await fetch(`${API_BASE_URL}/assignments`, {
      method: "GET",
      headers: getHeaders(token),
    });
    return handleResponse<{ message: string; data: Assignment[] }>(res);
  },

  getAssignmentById: async (
    id: number,
    token: string
  ): Promise<{ message: string; data: Assignment }> => {
    const res = await fetch(`${API_BASE_URL}/assignments/${id}`, {
      method: "GET",
      headers: getHeaders(token),
    });
    return handleResponse<{ message: string; data: Assignment }>(res);
  },

  deleteAssignment: async (
    id: number,
    token: string
  ): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/assignments/delete/${id}`, {
      method: "DELETE",
      headers: getHeaders(token),
    });
    return handleResponse<{ message: string }>(res);
  },

  updateAssignment: async (
    id: number,
    assignment: AssignmentUpdateRequest,
    token: string
  ): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/assignments/edit/${id}`, {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify(assignment),
    });
    return handleResponse<{ message: string }>(res);
  },

  // PDF Import → AI Generate
  importPdfsAndGenerate: async (
    files: File[],
    options?: {
      title?: string;
      description?: string;
      subject?: string;
      class_level?: string;
      grade_id?: number;
      duration_minutes?: number;
      question_groups?: Array<{
        type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
        count: number;
        difficulty: CognitiveLevel;
      }>;
      extra_requirements?: string;
    },
    token?: string | null
  ): Promise<{ message: string; data: AssignmentRequest }> => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("pdfs", file);
    }
    if (options) {
      if (options.title) formData.append("title", options.title);
      if (options.description) formData.append("description", options.description);
      if (options.subject) formData.append("subject", options.subject);
      if (options.class_level) formData.append("class_level", options.class_level);
      if (options.grade_id) formData.append("grade_id", String(options.grade_id));
      if (options.duration_minutes) formData.append("duration_minutes", String(options.duration_minutes));
      if (options.question_groups) {
        formData.append("question_groups", JSON.stringify(options.question_groups));
      }
      if (options.extra_requirements) formData.append("extra_requirements", options.extra_requirements);
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/pdf/import`, {
      method: "POST",
      headers,
      body: formData,
    });
    return handleResponse<{ message: string; data: AssignmentRequest }>(res);
  },
};

import type {
  AuthResponse,
  RegisterResponse,
  AiRequest,
  AssignmentRequest,
  Assignment,
} from "../types";

// const API_BASE_URL = "/api";
const API_BASE_URL = import.meta.env.VITE_API_URL||"/api";

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
    assignment: any,
    token: string
  ): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE_URL}/assignments/edit/${id}`, {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify(assignment),
    });
    return handleResponse<{ message: string }>(res);
  },
};

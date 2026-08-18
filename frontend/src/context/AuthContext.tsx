import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "edtech_access_token";
const USER_KEY = "edtech_user_info";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const login = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(u, p);
      setToken(response.accessToken);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      await api.register(u, p);
      // Auto login after registration
      const loginRes = await api.login(u, p);
      setToken(loginRes.accessToken);
      setUser(loginRes.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  return (// trả về những chỗ gọi đến AuthProvider với những component con của AuthProvider 
         // sẽ dc ném vào phần children ở trong lệnh trả về này.
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
      }}// chuyền dữ liệu vào context hiện tại(tức AuthContext) 
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);//kiểm tra component hiện tại có nằm trong AuthContext.Provider ko
  // nếu ko thì báo lỗi còn nếu có thì trả về dữ liệu của context hiện tại.
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

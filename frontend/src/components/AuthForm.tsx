import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export const AuthForm: React.FC = () => {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login, register, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim()) {
      setErrorMsg("Vui lòng nhập tên tài khoản");
      return;
    }

    if (!password) {
      setErrorMsg("Vui lòng nhập mật khẩu");
      return;
    }

    if (!isLoginTab && password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    try {
      if (isLoginTab) {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Đã xảy ra lỗi. Vui lòng thử lại.");
    }
  };

  const switchTab = (toLogin: boolean) => {
    setIsLoginTab(toLogin);
    setErrorMsg(null);
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h2>Hệ Thống Trợ Lý Giáo Viên AI</h2>
          <p>Tạo đề thi & bài tập tự động trong vài giây</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${isLoginTab ? "active" : ""}`}
            onClick={() => switchTab(true)}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`tab-btn ${!isLoginTab ? "active" : ""}`}
            onClick={() => switchTab(false)}
          >
            Đăng ký tài khoản
          </button>
        </div>

        {errorMsg && (
          <div className="alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Tên tài khoản</label>
            <input
              id="username"
              type="text"
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {!isLoginTab && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          )}

          <button type="submit" className="btn-primary auth-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <span className="spinner-container">
                <span className="spinner"></span>
                <span>Đang xử lý...</span>
              </span>
            ) : isLoginTab ? (
              "Đăng nhập hệ thống"
            ) : (
              "Tạo tài khoản giáo viên"
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isLoginTab ? (
            <p>
              Chưa có tài khoản?{" "}
              <button type="button" className="link-btn" onClick={() => switchTab(false)}>
                Đăng ký ngay
              </button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{" "}
              <button type="button" className="link-btn" onClick={() => switchTab(true)}>
                Đăng nhập
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

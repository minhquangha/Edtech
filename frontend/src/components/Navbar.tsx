import React from "react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  onCreateNewClick?: () => void;
  onImportPdfClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreateNewClick, onImportPdfClick }) => {
  const { user, logout } = useAuth();

  const usernameDisplay = user?.username || "Giáo viên";
  const avatarLetter = usernameDisplay ? usernameDisplay.charAt(0).toUpperCase() : "G";

  return (
    <header className="app-navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              <path d="M12 6h4"/>
              <path d="M12 10h4"/>
            </svg>
          </div>
          <span className="brand-title">EdTech AI Studio</span>
          <span className="brand-badge">{user?.role || "TEACHER"}</span>
        </div>

        {user && (
          <div className="navbar-actions">
            <button className="btn-primary create-btn" onClick={onCreateNewClick}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Tạo bài tập mới</span>
            </button>

            {onImportPdfClick && (
              <button className="btn-secondary btn-icon import-pdf-btn" onClick={onImportPdfClick} title="Import PDF">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <polyline points="9 15 12 18 15 15"></polyline>
                </svg>
                <span>Import PDF</span>
              </button>
            )}

            <div className="user-profile">
              <div className="avatar">
                {avatarLetter}
              </div>
              <span className="username">{usernameDisplay}</span>
            </div>

            <button className="btn-logout" onClick={logout} title="Đăng xuất">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

import React, { useState, Component, type ErrorInfo, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthForm } from "./components/AuthForm";
import { AssignmentList } from "./components/AssignmentList";
import { CreateAssignmentModal } from "./components/CreateAssignmentModal";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "3rem", textAlign: "center", fontFamily: "sans-serif", maxWidth: "600px", margin: "4rem auto", backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "1rem" }}>Đã xảy ra lỗi hiển thị giao diện</h2>
          <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>{this.state.error?.toString()}</p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ padding: "0.6rem 1.2rem", backgroundColor: "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
          >
            Tải lại trang & Đăng nhập lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return (
    <div className="app-layout">
      <Navbar onCreateNewClick={() => setIsCreateModalOpen(true)} />

      <main className="main-container">
        <AssignmentList
          onCreateNewClick={() => setIsCreateModalOpen(true)}
          refreshTrigger={refreshTrigger}
        />
      </main>

      <CreateAssignmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}

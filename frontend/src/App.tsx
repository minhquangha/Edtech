import { useState, Component, type ErrorInfo, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { AuthForm } from "./components/AuthForm";
import { AssignmentList } from "./components/AssignmentList";
import { CreateAssignmentModal } from "./components/CreateAssignmentModal";
import { ImportPdfModal } from "./components/ImportPdfModal";
import type { AssignmentRequest } from "./types";

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
  }//React tự gọi khi có lỗi xảy ra trong component con

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }//React tự gọi sau khi bắt lỗi
  public render() {//Hàm này sẽ dc react gọi ở lần đầu tiên chạy ứng dụng trên trình duyệt
                   // và khi state ở trên thay đổi
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
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [importedAssignment, setImportedAssignment] = useState<AssignmentRequest | null>(null);

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return (
    <div className="app-layout">
      <Navbar
        onCreateNewClick={() => setIsCreateModalOpen(true)}
        onImportPdfClick={() => setIsPdfModalOpen(true)}
      />

      <main className="main-container">
        <AssignmentList
          onCreateNewClick={() => setIsCreateModalOpen(true)}
          refreshTrigger={refreshTrigger}
        />
      </main>

      <ImportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
          setIsPdfModalOpen(false);
        }}
      />

      <CreateAssignmentModal
        key={importedAssignment ? `imported-${Date.now()}` : "normal"}
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setImportedAssignment(null);
        }}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
          setImportedAssignment(null);
        }}
        prefillData={importedAssignment}
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

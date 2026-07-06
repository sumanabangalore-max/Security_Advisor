import { useState, useEffect } from "react";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<"admin" | "analyst" | "viewer">("viewer");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Restore session on mount
    const savedToken = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role") as any;

    if (savedToken && savedUsername && savedRole) {
      setToken(savedToken);
      setUsername(savedUsername);
      setRole(savedRole);
    }
    setInitialized(true);
  }, []);

  const handleLoginSuccess = (newToken: string, newUsername: string, newRole: "admin" | "analyst" | "viewer") => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", newUsername);
    localStorage.setItem("role", newRole);

    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");

    setToken(null);
    setUsername("");
    setRole("viewer");
  };

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        Initializing Security Advisory Tracker...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {!token ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard username={username} userRole={role} onLogout={handleLogout} />
      )}
    </div>
  );
}

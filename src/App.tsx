import { useState, useEffect } from "react";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import { UserRole } from "./types";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Restore session on mount
    const savedToken = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role") as UserRole;

    if (savedToken && savedUsername && savedRole) {
      setToken(savedToken);
      setUsername(savedUsername);
      setRole(savedRole);
    }
    setInitialized(true);
  }, []);

  const handleLoginSuccess = (newToken: string, newUsername: string, newRole: UserRole) => {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600 font-sans text-xs font-semibold">
        Initializing SecAdvisor Enterprise Suite...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
      {!token ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard username={username} userRole={role} onLogout={handleLogout} />
      )}
    </div>
  );
}

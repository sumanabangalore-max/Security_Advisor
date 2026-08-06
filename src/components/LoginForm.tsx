import { useState, FormEvent } from "react";
import { Shield, Key, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";

interface LoginFormProps {
  onLoginSuccess: (token: string, username: string, role: "admin" | "analyst" | "viewer") => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(data.detail || "Invalid credentials");
      }

      const data = await res.json();
      onLoginSuccess(data.access_token, data.username, data.role);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (user: string) => {
    setUsername(user);
    setPassword(user);
    setError("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-800">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
        id="login-card"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-xs">
            <Shield className="h-7 w-7" id="login-shield-icon" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">SecAdvisor Enterprise</h2>
          <p className="text-xs text-slate-500 font-medium">Security Advisory Suite & Active Directory SSO</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 text-center" id="login-error-msg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Username / sAMAccountName</label>
            <div className="relative">
              <input
                id="login-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin, analyst, or jdoe@corp.internal"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Password</label>
            <div className="relative">
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <button
                type="button"
                id="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Authenticating with Active Directory..." : "Sign In to Enterprise Workspace"}
          </button>
        </form>

        <div className="border-t border-slate-200 pt-4 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Quick Demo Profiles:</div>
          <div className="grid grid-cols-3 gap-2" id="sandbox-roles">
            <button
              onClick={() => fillCredentials("admin")}
              type="button"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition-all cursor-pointer"
            >
              Admin Role
            </button>
            <button
              onClick={() => fillCredentials("analyst")}
              type="button"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold hover:bg-slate-100 transition-all cursor-pointer"
            >
              Analyst Role
            </button>
            <button
              onClick={() => fillCredentials("viewer")}
              type="button"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-semibold hover:bg-slate-100 transition-all cursor-pointer"
            >
              Viewer Role
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-500">Password is same as username (e.g. username 'admin', password 'admin')</p>
        </div>
      </motion.div>
    </div>
  );
}

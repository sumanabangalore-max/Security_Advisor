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
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-300">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8 rounded-lg border border-zinc-800 bg-[#121214] p-8 shadow-2xl"
        id="login-card"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded bg-emerald-600/10 text-emerald-400">
            <Shield className="h-6 w-6" id="login-shield-icon" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">SEC_ADVISOR</h2>
          <p className="text-sm text-zinc-500">Sign in to manage CVE matches & compliance</p>
        </div>

        {error && (
          <div className="rounded border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400 text-center" id="login-error-msg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Username</label>
            <div className="relative">
              <input
                id="login-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin, analyst, viewer"
                className="w-full rounded border border-zinc-700 bg-zinc-900 py-2.5 pl-3 pr-10 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Password</label>
            <div className="relative">
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-zinc-700 bg-zinc-900 py-2.5 pl-3 pr-10 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                id="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            className="w-full rounded bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        <div className="border-t border-zinc-800/80 pt-6 space-y-3">
          <div className="text-center">
            <span className="bg-[#121214] px-2 text-xs text-zinc-500 uppercase tracking-widest">Quick Sandbox Access</span>
          </div>
          <div className="grid grid-cols-3 gap-2" id="sandbox-roles">
            <button
              onClick={() => fillCredentials("admin")}
              type="button"
              className="rounded border border-zinc-700 bg-zinc-800 py-2 text-center text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all cursor-pointer"
            >
              Admin Role
            </button>
            <button
              onClick={() => fillCredentials("analyst")}
              type="button"
              className="rounded border border-zinc-700 bg-zinc-800 py-2 text-center text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all cursor-pointer"
            >
              Analyst Role
            </button>
            <button
              onClick={() => fillCredentials("viewer")}
              type="button"
              className="rounded border border-zinc-700 bg-zinc-800 py-2 text-center text-xs font-medium text-zinc-400 hover:border-zinc-500 hover:text-white transition-all cursor-pointer"
            >
              Viewer Role
            </button>
          </div>
          <p className="text-[10px] text-center text-zinc-600">Password is the same as the username (e.g. username &apos;admin&apos;, password &apos;admin&apos;)</p>
        </div>
      </motion.div>
    </div>
  );
}

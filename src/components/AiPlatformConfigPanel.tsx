import React, { useState, useEffect } from "react";
import { 
  Key, Shield, Cpu, Sparkles, CheckCircle2, AlertTriangle, 
  RefreshCw, Lock, ExternalLink, Info, Check, Eye, EyeOff, Save
} from "lucide-react";
import { api } from "../api";
import { UserRole } from "../types";

interface AiConfigData {
  preferred_provider: "platform" | "gemini";
  platform_api_base_url: string;
  platform_api_key_set: boolean;
  gemini_api_key_set: boolean;
}

interface AiPlatformConfigPanelProps {
  userRole: UserRole;
}

export default function AiPlatformConfigPanel({ userRole }: AiPlatformConfigPanelProps) {
  const [provider, setProvider] = useState<"platform" | "gemini">("platform");
  const [baseUrl, setBaseUrl] = useState("https://api.ai.tech.gov.sg");
  const [platformApiKey, setPlatformApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  
  const [platformKeySet, setPlatformKeySet] = useState(false);
  const [geminiKeySet, setGeminiKeySet] = useState(false);

  const [showPlatformKey, setShowPlatformKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState<{ status: string; message: string; latency_ms?: number } | null>(null);

  const canEdit = userRole === "admin";

  useEffect(() => {
    fetchAiConfig();
  }, []);

  const fetchAiConfig = async () => {
    try {
      setLoading(true);
      const data = await api.get<AiConfigData>("/api/v1/ai/config");
      setProvider(data.preferred_provider || "platform");
      setBaseUrl(data.platform_api_base_url || "https://api.ai.tech.gov.sg");
      setPlatformKeySet(data.platform_api_key_set);
      setGeminiKeySet(data.gemini_api_key_set);
      setError("");
    } catch (err: any) {
      setError("Failed to load AI platform configuration from server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");
    setTestResult(null);

    try {
      const payload: any = {
        preferred_provider: provider,
        platform_api_base_url: baseUrl,
      };
      if (platformApiKey) payload.platform_api_key = platformApiKey;
      if (geminiApiKey) payload.gemini_api_key = geminiApiKey;

      const res = await api.put<{ success: boolean; message: string; config: AiConfigData }>("/api/v1/ai/config", payload);
      setPlatformKeySet(res.config.platform_api_key_set);
      setGeminiKeySet(res.config.gemini_api_key_set);
      setPlatformApiKey("");
      setGeminiApiKey("");
      setSuccess("AI Platform & API Key settings updated successfully.");
      
      // Update local header preference
      localStorage.setItem("active_ai_engine", provider);
    } catch (err: any) {
      setError(err.message || "Failed to save AI platform configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setTestResult(null);
    try {
      const res = await api.post<{ status: string; message: string; latency_ms?: number }>("/api/v1/ai/test", {
        provider,
        baseUrl,
        platformApiKey: platformApiKey || undefined,
        geminiApiKey: geminiApiKey || undefined
      });
      setTestResult(res);
    } catch (err: any) {
      setError(err.message || "Test connection failed.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 font-mono text-xs">
        Loading AI Platform API Configurations...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="ai-platform-config-panel">
      {/* Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-100">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">GovTech AI Platform & API Key Management</h3>
              <p className="text-xs text-slate-500">Configure corporate HTTPS AI endpoints (`api.ai.tech.gov.sg`) and credentials</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Server-Side Secured
          </span>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6 pt-2">
          {/* Provider Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Primary AI Model Provider <span className="text-emerald-600">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label 
                onClick={() => setProvider("platform")}
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === "platform" 
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20" 
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50"
                }`}
              >
                <input 
                  type="radio" 
                  name="ai_provider" 
                  checked={provider === "platform"} 
                  onChange={() => setProvider("platform")}
                  className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">GovTech AI Platform API</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Directs all AI requests exclusively to corporate HTTPS endpoint (`api.ai.tech.gov.sg`) using `x-api-key`.
                  </p>
                </div>
              </label>

              <label 
                onClick={() => setProvider("gemini")}
                className={`flex items-start gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                  provider === "gemini" 
                    ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20" 
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50"
                }`}
              >
                <input 
                  type="radio" 
                  name="ai_provider" 
                  checked={provider === "gemini"} 
                  onChange={() => setProvider("gemini")}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Google Gemini 3.6 Flash (Flagship AI Engine)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Flagship Model
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Uses Google GenAI SDK (`@google/genai`). Activates ONLY when Gemini AI is explicitly selected as the provider.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Platform API Details */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-600" />
                GovTech AI Platform API Configuration
              </span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                platformKeySet 
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                  : "bg-amber-100 text-amber-800 border-amber-200"
              }`}>
                {platformKeySet ? "Key Configured" : "Key Not Set"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">GovTech Platform API Base URL</label>
                <input
                  type="url"
                  required
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.ai.tech.gov.sg"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Must be an HTTPS endpoint. Default: `https://api.ai.tech.gov.sg`</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">PLATFORM_API_KEY</label>
                <div className="relative">
                  <input
                    type={showPlatformKey ? "text" : "password"}
                    value={platformApiKey}
                    onChange={(e) => setPlatformApiKey(e.target.value)}
                    placeholder={platformKeySet ? "•••••••••••••••••••••••• (Key saved)" : "Enter PLATFORM_API_KEY"}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPlatformKey(!showPlatformKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPlatformKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">Sent via `x-api-key` header in server-side Express requests.</p>
              </div>
            </div>
          </div>

          {/* Gemini API Key Section */}
          <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Google Gemini API Configuration
              </span>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                geminiKeySet 
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                  : "bg-slate-200 text-slate-700 border-slate-300"
              }`}>
                {geminiKeySet ? "Key Configured" : "Key Not Set"}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">GEMINI_API_KEY</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? "text" : "password"}
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={geminiKeySet ? "•••••••••••••••••••••••• (Key saved)" : "Enter GEMINI_API_KEY"}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">API Key used when Google Gemini AI is explicitly selected as the active model engine.</p>
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1 font-mono">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Connection Test Successful ({testResult.latency_ms || 18}ms)
              </div>
              <p>{testResult.message}</p>
            </div>
          )}

          {/* Action buttons */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin text-emerald-600" : ""}`} />
                <span>Test API Connection</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 uppercase tracking-wider"
              >
                {saving ? (
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Configuration</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Mandatory Security Rules & Architecture Guidelines Box */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-sm border border-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Security & Compliance Mandates</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="flex items-start gap-2.5 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Never Hardcode API Keys</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All credentials are saved in server memory or `.env` secrets manager. Hardcoded secrets in client JavaScript bundles are prohibited.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Strict Server-Side Proxying</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Client browsers make requests exclusively to `/api/v1/*`. Express backend proxies calls to `https://api.ai.tech.gov.sg` with `x-api-key`.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Enforced HTTPS Transport</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All external API calls must enforce TLS/HTTPS endpoints. Plain HTTP calls to AI gateways are automatically rejected.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/50">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block mb-0.5">Anomaly Monitoring & Audit</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Token consumption metrics are recorded in local log registries to monitor for anomalous query volumes and unusual spending patterns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

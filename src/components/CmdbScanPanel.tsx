import React, { useState, useEffect } from "react";
import { Shield, Settings, Play, CheckCircle2, AlertTriangle, Cpu, Lock, KeyRound, X, RefreshCw } from "lucide-react";
import { api } from "../api";
import { ScanSettingsConfig, ScanProgressState } from "../types";

interface CmdbScanPanelProps {
  userRole: "admin" | "analyst" | "viewer";
  scanProgress: ScanProgressState;
  onScanTriggered: (cveId?: string) => void;
  onSettingsChanged: () => void;
}

export default function CmdbScanPanel({ userRole, scanProgress, onScanTriggered, onSettingsChanged }: CmdbScanPanelProps) {
  const [settings, setSettings] = useState<ScanSettingsConfig>({ auto_scan: false, scan_window_days: 7 });
  const [singleCveId, setSingleCveId] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset Modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUsername, setResetUsername] = useState("admin");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await api.get<ScanSettingsConfig>("/api/v1/scan/settings");
      setSettings(data);
    } catch (err: any) {
      setError("Failed to load scan settings");
    }
  };

  const handleOpenResetModal = () => {
    if (userRole !== "admin") {
      setError("Access Denied: Reset Database & Inventory function requires Admin role.");
      return;
    }
    setError("");
    setResetError("");
    setResetPassword("");
    setResetUsername("admin");
    setShowResetModal(true);
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword) {
      setResetError("Please enter the admin password.");
      return;
    }

    setResetLoading(true);
    setResetError("");

    try {
      await api.post("/api/v1/scan/reset", {
        username: resetUsername.trim(),
        password: resetPassword
      });
      setShowResetModal(false);
      setResetPassword("");
      onSettingsChanged();
    } catch (err: any) {
      setResetError(err.message || "Failed to reset database. Invalid credentials.");
    } finally {
      setResetLoading(false);
    }
  };

  const toggleAutoScan = async () => {
    if (!canEdit) return;
    const updated = { ...settings, auto_scan: !settings.auto_scan };
    try {
      setSettings(updated);
      await api.patch("/api/v1/scan/settings", updated);
      onSettingsChanged();
    } catch (err) {
      setError("Failed to save auto-scan state");
    }
  };

  const selectWindow = async (days: number) => {
    if (!canEdit) return;
    const updated = { ...settings, scan_window_days: days };
    try {
      setSettings(updated);
      await api.patch("/api/v1/scan/settings", updated);
      onSettingsChanged();
    } catch (err) {
      setError("Failed to save window days");
    }
  };

  const handleScanNow = () => {
    if (!canEdit) return;
    onScanTriggered(singleCveId ? singleCveId.trim() : undefined);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6 shadow-xs" id="cmdb-scan-panel">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">CMDB CVE Scan</h3>
            <p className="text-[11px] text-slate-500">Configure parameters and scan inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <button
              id="auto-scan-toggle"
              onClick={toggleAutoScan}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.auto_scan ? "bg-indigo-600" : "bg-slate-200"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.auto_scan ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          ) : (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${settings.auto_scan ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
              {settings.auto_scan ? "Auto-Scan On" : "Auto-Scan Off"}
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-600">24h Continuous</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

      {/* Mutually Exclusive Window Days */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scan Lookup Window</span>
        <div className="grid grid-cols-2 gap-2" id="scan-window-toggles">
          <button
            onClick={() => selectWindow(7)}
            disabled={!canEdit}
            className={`rounded-xl py-2 text-[10px] font-bold border transition-all ${!canEdit ? "opacity-60" : "cursor-pointer"} ${settings.scan_window_days === 7 ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
          >
            7 DAYS (Recent)
          </button>
          <button
            onClick={() => selectWindow(14)}
            disabled={!canEdit}
            className={`rounded-xl py-2 text-[10px] font-bold border transition-all ${!canEdit ? "opacity-60" : "cursor-pointer"} ${settings.scan_window_days === 14 ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
          >
            14 DAYS (Extended)
          </button>
        </div>
      </div>

      {/* Single CVE Scan & Action */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Optional: Target CVE-ID</label>
          <input
            id="single-cve-input"
            type="text"
            value={singleCveId}
            onChange={(e) => setSingleCveId(e.target.value)}
            disabled={!canEdit || scanProgress.is_scanning}
            placeholder="e.g. CVE-2021-41773"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:bg-white transition-colors disabled:opacity-50 font-mono"
          />
        </div>

        <button
          id="trigger-scan-btn"
          onClick={handleScanNow}
          disabled={!canEdit || scanProgress.is_scanning}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {scanProgress.is_scanning ? "SCAN IN PROGRESS..." : "SCAN CMDB NOW"}
        </button>

        {canEdit && (
          <button
            id="reset-db-btn"
            onClick={handleOpenResetModal}
            disabled={scanProgress.is_scanning}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 transition-all cursor-pointer"
            title="Reset systems back to vulnerable versions for testing (Requires Admin Password)"
          >
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            Reset Database & Inventory (Unpatch)
          </button>
        )}
      </div>

      {/* Admin Password Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 relative">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-red-50 p-2 text-red-600 border border-red-100">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Admin Authentication Required</h3>
                <p className="text-[11px] text-slate-500">Confirm administrator password to reset database</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Resetting the CMDB database and inventory restores all asset software to their initial unpatched state. Only authorized <strong className="text-red-600">Admin</strong> users can execute this operation.
            </p>

            {resetError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteReset} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin Username</label>
                <input
                  type="text"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-red-500 focus:bg-white focus:outline-none transition-colors font-mono"
                  placeholder="admin"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-red-500 focus:bg-white focus:outline-none transition-colors font-mono"
                    placeholder="Enter admin password..."
                    autoFocus
                    required
                  />
                  <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-500">Default admin password is <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">admin</code></p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Authenticating & Resetting...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" />
                      Authenticate & Reset DB
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Section */}
      {(scanProgress.is_scanning || scanProgress.percentage > 0) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5" id="scan-progress-box">
          <div className="flex items-center justify-between text-[10px] font-medium font-mono">
            <span className="text-slate-500">
              {scanProgress.is_scanning ? (
                <span className="flex items-center gap-1.5 text-indigo-600 font-bold">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600" />
                  {scanProgress.current_cve || "Scanning..."}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Scan Finished
                </span>
              )}
            </span>
            <span className="text-indigo-600 font-bold">{scanProgress.percentage}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${scanProgress.percentage}%` }}
              id="scan-progress-bar"
            />
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
          <Shield className="h-3.5 w-3.5 text-slate-400" />
          <span>Viewing only. Contact system administrator to trigger scans.</span>
        </div>
      )}
    </div>
  );
}

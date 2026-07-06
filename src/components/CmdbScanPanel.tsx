import { useState, useEffect } from "react";
import { Shield, Settings, Play, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
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
    <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-6 shadow-md" id="cmdb-scan-panel">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">CMDB CVE Scan</h3>
            <p className="text-[11px] text-zinc-500">Configure parameters and scan inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <button
              id="auto-scan-toggle"
              onClick={toggleAutoScan}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.auto_scan ? "bg-emerald-600" : "bg-zinc-800"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${settings.auto_scan ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          ) : (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${settings.auto_scan ? "bg-emerald-600/15 text-emerald-400 border border-emerald-600/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
              {settings.auto_scan ? "Auto-Scan On" : "Auto-Scan Off"}
            </span>
          )}
          <span className="text-[11px] font-medium text-zinc-400">24h Continuous</span>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

      {/* Mutually Exclusive Window Days */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Scan Lookup Window</span>
        <div className="grid grid-cols-2 gap-2" id="scan-window-toggles">
          <button
            onClick={() => selectWindow(7)}
            disabled={!canEdit}
            className={`rounded py-2 text-[10px] font-bold border transition-all ${!canEdit ? "opacity-60" : "cursor-pointer"} ${settings.scan_window_days === 7 ? "border-zinc-700 bg-zinc-800 text-white" : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"}`}
          >
            7 DAYS (Recent)
          </button>
          <button
            onClick={() => selectWindow(14)}
            disabled={!canEdit}
            className={`rounded py-2 text-[10px] font-bold border transition-all ${!canEdit ? "opacity-60" : "cursor-pointer"} ${settings.scan_window_days === 14 ? "border-zinc-700 bg-zinc-800 text-white" : "border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"}`}
          >
            14 DAYS (Extended)
          </button>
        </div>
      </div>

      {/* Single CVE Scan & Action */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Optional: Target CVE-ID</label>
          <input
            id="single-cve-input"
            type="text"
            value={singleCveId}
            onChange={(e) => setSingleCveId(e.target.value)}
            disabled={!canEdit || scanProgress.is_scanning}
            placeholder="e.g. CVE-2021-41773"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors disabled:opacity-50 font-mono"
          />
        </div>

        <button
          id="trigger-scan-btn"
          onClick={handleScanNow}
          disabled={!canEdit || scanProgress.is_scanning}
          className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 active:translate-y-px transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className="h-3 w-3 fill-current" />
          {scanProgress.is_scanning ? "SCAN IN PROGRESS..." : "SCAN CMDB NOW"}
        </button>
      </div>

      {/* Progress Section */}
      {(scanProgress.is_scanning || scanProgress.percentage > 0) && (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-2.5" id="scan-progress-box">
          <div className="flex items-center justify-between text-[10px] font-medium font-mono">
            <span className="text-zinc-500">
              {scanProgress.is_scanning ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {scanProgress.current_cve || "Scanning..."}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <CheckCircle2 className="h-3.5 w-3.5 text-zinc-500" />
                  Scan Finished
                </span>
              )}
            </span>
            <span className="text-emerald-400">{scanProgress.percentage}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${scanProgress.percentage}%` }}
              id="scan-progress-bar"
            />
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 rounded bg-zinc-900/60 p-3 text-[10px] text-zinc-500 border border-zinc-800/40">
          <Shield className="h-3.5 w-3.5 text-zinc-600" />
          <span>Viewing only. Contact system administrator to trigger scans.</span>
        </div>
      )}
    </div>
  );
}

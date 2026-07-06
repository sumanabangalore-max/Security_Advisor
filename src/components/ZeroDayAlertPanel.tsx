import React, { useState, useEffect } from "react";
import { ShieldAlert, Flame, Terminal, Play, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, Cpu, HelpCircle } from "lucide-react";
import { api } from "../api";
import { Vulnerability } from "../types";

interface ZeroDayAlertPanelProps {
  userRole: "admin" | "analyst" | "viewer";
  refreshTrigger: number;
  onPatched: () => void;
}

export default function ZeroDayAlertPanel({ userRole, refreshTrigger, onPatched }: ZeroDayAlertPanelProps) {
  const [zeroDays, setZeroDays] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);

  // States for live patching simulation per vulnerability
  const [patching, setPatching] = useState<Record<number, boolean>>({});
  const [patchSuccess, setPatchSuccess] = useState<Record<number, boolean>>({});
  const [patchLogs, setPatchLogs] = useState<Record<number, string[]>>({});

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchZeroDays();
  }, [refreshTrigger]);

  const fetchZeroDays = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ vulnerabilities: Vulnerability[] }>("/api/v1/vulnerabilities?status=Open&limit=500");
      const activeZd = (res.vulnerabilities || []).filter(v => v.is_zero_day && v.status === "Open");
      setZeroDays(activeZd);
      // Auto-expand the first zero-day if available
      if (activeZd.length > 0 && expandedVuln === null) {
        setExpandedVuln(activeZd[0].id);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleRunPatchAgent = async (v: Vulnerability) => {
    if (!canEdit || patching[v.id]) return;

    setPatching(prev => ({ ...prev, [v.id]: true }));
    setPatchSuccess(prev => ({ ...prev, [v.id]: false }));
    setPatchLogs(prev => ({
      ...prev,
      [v.id]: [
        "[SYSTEM] Activating high-priority security sandbox proxy...",
        `[SYSTEM] Connecting to vulnerable target instance: ${v.hostname} (${v.ip_address})`,
        "[SYSTEM] Querying zero-day containment and virtual patching policies...",
      ]
    }));

    try {
      const res = await api.post<{ status: string; message: string; logs: string[] }>(
        `/api/v1/vulnerabilities/${v.id}/remediate-agent`
      );

      let logIndex = 0;
      const interval = setInterval(() => {
        setPatchLogs(prev => {
          const currentLogs = prev[v.id] || [];
          if (logIndex < res.logs.length) {
            const nextLog = res.logs[logIndex++];
            return { ...prev, [v.id]: [...currentLogs, nextLog] };
          } else {
            clearInterval(interval);
            setPatching(prevPatching => ({ ...prevPatching, [v.id]: false }));
            setPatchSuccess(prevSuccess => ({ ...prevSuccess, [v.id]: true }));
            
            // Wait 2 seconds, then refresh the dashboard data so the mitigated item is removed from active zero days
            setTimeout(() => {
              onPatched();
              fetchZeroDays();
            }, 2000);

            return prev;
          }
        });
      }, 400);

    } catch (err: any) {
      setPatchLogs(prev => ({
        ...prev,
        [v.id]: [
          ...(prev[v.id] || []),
          `[FATAL] Autonomous agent failed to apply virtual patch: ${err.message || "Connection refused"}`
        ]
      }));
      setPatching(prev => ({ ...prev, [v.id]: false }));
    }
  };

  if (zeroDays.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-500/40 bg-gradient-to-br from-red-950/20 to-zinc-950/40 p-5 space-y-4 shadow-xl relative overflow-hidden" id="zero-day-outbreak-alert">
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl animate-pulse pointer-events-none" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded bg-red-500/20 p-2 text-red-400 border border-red-500/30 animate-pulse">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono mb-1">
              Active Outbreak
            </span>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              Zero-Day Threats Detected ({zeroDays.length})
            </h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xl">
              Unpatched vulnerabilities with active exploits circulating in the wild have been matched to your container inventory. Immediate manual mitigation or AI-guided virtual patching is required to secure public interfaces.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {zeroDays.map((v) => {
          const isExpanded = expandedVuln === v.id;
          const isPatching = patching[v.id];
          const isSuccess = patchSuccess[v.id];
          const logs = patchLogs[v.id] || [];

          return (
            <div 
              key={v.id} 
              className={`rounded border transition-all ${
                isExpanded 
                  ? "border-red-500/30 bg-[#160d0e]/60" 
                  : "border-zinc-800 bg-zinc-950/40 hover:border-red-500/20"
              }`}
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                onClick={() => setExpandedVuln(isExpanded ? null : v.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono font-bold text-red-400 shrink-0">
                    {v.cve_id}
                  </span>
                  <div className="h-3.5 w-px bg-zinc-800 shrink-0" />
                  <span className="text-xs font-semibold text-white truncate">
                    {v.software_name} v{v.version}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                    {v.environment}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-extrabold font-mono px-2 py-0.5 uppercase tracking-wider">
                    CRITICAL 10.0
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
              </div>

              {/* Collapsible details */}
              {isExpanded && (
                <div className="border-t border-zinc-800/40 p-4 space-y-4 text-xs">
                  {/* Summary & Impact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Exploitation Intel
                      </span>
                      <p className="text-zinc-300 leading-relaxed font-medium">
                        {v.summary}
                      </p>
                      <p className="text-zinc-500 text-[11px] leading-relaxed">
                        <strong>Affected CPE:</strong> <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-[10px]">{v.affected_cpe}</code>
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded bg-red-500/[0.02] border border-red-500/10 p-3">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <Cpu className="h-3 w-3 text-red-400" />
                        Impact Analysis
                      </span>
                      <p className="text-zinc-300 text-[11px] leading-normal">
                        {v.impact_analysis || "Exploitation allows remote administrative bypass. Immediate memory disclosure or control hijack risk."}
                      </p>
                    </div>
                  </div>

                  {/* Technical Steps & Workaround Details */}
                  <div className="space-y-2 border-t border-zinc-850 pt-3">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                      Immediate Technical Workaround Steps
                    </span>
                    <div className="rounded border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 text-[11px] font-mono leading-relaxed text-zinc-300">
                      <p className="text-amber-400 font-bold mb-1 uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Critical Workaround Directives
                      </p>
                      <p>{v.mitigation || "Disable affected services, bind host process exclusively to localhost interfaces, and apply strict firewall access policies."}</p>
                      
                      <div className="mt-3 bg-zinc-900/60 p-2.5 rounded border border-zinc-800/60">
                        <span className="text-[9px] font-bold text-zinc-500 block mb-1 uppercase tracking-widest">Linux / Docker Mitigation CLI</span>
                        <code className="text-emerald-400 break-all select-all block">
                          {v.software_name.toLowerCase().includes("apache") 
                            ? "docker exec -it cve-tracker-ui sed -i 's/LoadModule proxy_module/#LoadModule proxy_module/g' /etc/apache2/httpd.conf && docker restart cve-tracker-ui"
                            : "docker exec -it cve-tracker-ui openssl ciphers -v | grep TLSv1.3 # verify active cipher suits"}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Action Buttons & Agent Logs */}
                  <div className="border-t border-zinc-850 pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Remediation Status</span>
                        <span className="text-[11px] text-zinc-500">
                          {isSuccess 
                            ? "Secured by Autonomous Virtual Patching" 
                            : isPatching 
                              ? "Patching in progress..." 
                              : "Requires immediate attention"}
                        </span>
                      </div>

                      {isSuccess ? (
                        <div className="inline-flex items-center gap-1.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider font-mono">
                          <CheckCircle2 className="h-4 w-4" />
                          Mitigated
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRunPatchAgent(v)}
                          disabled={!canEdit || isPatching}
                          className="inline-flex items-center justify-center gap-2 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-bold text-white py-2 px-4 uppercase tracking-wider transition-all shadow-md cursor-pointer active:scale-95 shrink-0"
                        >
                          <Play className={`h-3.5 w-3.5 ${isPatching ? "animate-spin" : ""}`} />
                          {isPatching ? "Running AI Patch Agent..." : "⚡ Deploy AI Patch Agent"}
                        </button>
                      )}
                    </div>

                    {/* Scrolling terminal output */}
                    {(isPatching || logs.length > 0) && (
                      <div className="rounded border border-zinc-850 bg-black p-3.5 space-y-1 font-mono text-[10px] text-zinc-400 max-h-44 overflow-y-auto mt-2">
                        <div className="border-b border-zinc-850 pb-1.5 mb-2 flex justify-between items-center">
                          <span className="text-zinc-500 uppercase tracking-widest font-bold text-[8px] flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                            Live Virtual Patch Terminal logs
                          </span>
                          <span className="text-[8px] text-zinc-600">Secure Protocol v1.4</span>
                        </div>
                        {logs.map((log, i) => (
                          <div 
                            key={i} 
                            className={
                              log.startsWith("[FATAL]") 
                                ? "text-red-400 font-semibold" 
                                : log.startsWith("[SYSTEM]") 
                                  ? "text-zinc-500" 
                                  : "text-emerald-400"
                            }
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

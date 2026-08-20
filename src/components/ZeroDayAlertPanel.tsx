import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, Flame, Terminal, Play, CheckCircle2, ChevronDown, 
  ChevronUp, AlertTriangle, Cpu, HelpCircle, ShieldCheck, Copy, Check, Server, Layers, Mail
} from "lucide-react";
import { api } from "../api";
import { Vulnerability, UserRole, InventoryItem } from "../types";

interface ZeroDayAlertPanelProps {
  userRole: UserRole;
  refreshTrigger: number;
  onPatched: () => void;
  onDeployAgent?: (vuln: Vulnerability) => void;
}

export default function ZeroDayAlertPanel({ userRole, refreshTrigger, onPatched, onDeployAgent }: ZeroDayAlertPanelProps) {
  const [zeroDays, setZeroDays] = useState<Vulnerability[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [copiedCve, setCopiedCve] = useState<string | null>(null);

  // States for live patching simulation per vulnerability
  const [patching, setPatching] = useState<Record<number, boolean>>({});
  const [patchSuccess, setPatchSuccess] = useState<Record<number, boolean>>({});
  const [patchLogs, setPatchLogs] = useState<Record<number, string[]>>({});

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchZeroDays();
    fetchInventory();
  }, [refreshTrigger]);

  const fetchInventory = async () => {
    try {
      const data = await api.get<InventoryItem[]>("/api/v1/inventory");
      setInventoryItems(data || []);
    } catch {
      // silent
    }
  };

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

  const handleCopyCve = (cveId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cveId);
    setCopiedCve(cveId);
    setTimeout(() => setCopiedCve(null), 2000);
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
    <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 space-y-4 shadow-xs relative overflow-hidden" id="zero-day-outbreak-alert">
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-600 p-2.5 text-white shadow-xs animate-pulse">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wider font-mono mb-1">
              Active Outbreak
            </span>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              Zero-Day Threats Detected ({zeroDays.length})
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
              Unpatched vulnerabilities with active exploits circulating in the wild have been matched to your container inventory. Immediate manual mitigation or AI-guided virtual patching is required to secure public interfaces.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {zeroDays.map((v) => {
          const isExpanded = expandedVuln === v.id;
          const isPatching = patching[v.id];
          const isSuccess = patchSuccess[v.id];
          const logs = patchLogs[v.id] || [];

          // Find all impacted CIs in inventory
          const matchingCIs = inventoryItems.filter(item => {
            const matchName = item.software_name?.toLowerCase() === v.software_name?.toLowerCase();
            const matchHost = v.hostname && item.hostname === v.hostname;
            const matchCpe = v.affected_cpe && item.cpe_uri && (item.cpe_uri.includes(v.software_name.toLowerCase()) || v.affected_cpe === item.cpe_uri);
            return matchName || matchHost || matchCpe;
          });

          return (
            <div 
              key={v.id} 
              className={`rounded-xl border transition-all ${
                isExpanded 
                  ? "border-red-300 bg-white shadow-xs" 
                  : "border-red-100 bg-white/90 hover:border-red-300"
              }`}
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between p-3.5 cursor-pointer select-text"
                onClick={() => setExpandedVuln(isExpanded ? null : v.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono font-bold text-red-600 select-text cursor-text">
                      {v.cve_id}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyCve(v.cve_id, e)}
                      className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-700 transition-colors cursor-pointer"
                      title="Copy CVE ID"
                    >
                      {copiedCve === v.cve_id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="h-3.5 w-px bg-slate-200 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {v.software_name} v{v.version}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 uppercase px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                    {v.environment}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 hidden sm:inline-block">
                    Host: {v.hostname}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="rounded-full bg-red-100 text-red-700 border border-red-200 text-[10px] font-extrabold font-mono px-2.5 py-0.5 uppercase tracking-wider">
                    CRITICAL 10.0
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Collapsible details */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4 text-xs select-text">
                  {/* Recommended Upgrade Target Banner */}
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 space-y-1 shadow-xs">
                    <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-xs uppercase tracking-wider">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      Remediation Target (Package Version & Container Image)
                    </div>
                    <p className="text-xs font-bold text-emerald-950">
                      Upgrade <span className="underline">{v.software_name}</span> from v{v.version} to <span className="text-emerald-800 underline">v{v.fixed_version || "latest patch"}</span>
                      {v.fixed_image ? <> or deploy container image <code className="bg-white border border-emerald-300 px-1.5 py-0.5 rounded font-mono text-emerald-900 font-bold">{v.fixed_image}</code></> : ""}.
                    </p>
                  </div>

                  {/* Impacted Configuration Items (CIs) Section */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-amber-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Impacted Configuration Items (CIs / Assets)
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                        {matchingCIs.length > 0 ? `${matchingCIs.length} CI${matchingCIs.length > 1 ? "s" : ""} Bound` : "1 Primary CI Instance"}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            <th className="px-3 py-2">CI Hostname</th>
                            <th className="px-3 py-2">IP Address</th>
                            <th className="px-3 py-2">Environment</th>
                            <th className="px-3 py-2">Software & Version</th>
                            <th className="px-3 py-2">Owner / Custodian</th>
                            <th className="px-3 py-2">PIC Email</th>
                            <th className="px-3 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {matchingCIs.length > 0 ? (
                            matchingCIs.map((ci) => (
                              <tr key={ci.id} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                  <Server className="h-3 w-3 text-slate-400 shrink-0" />
                                  {ci.hostname || v.hostname}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-600">{ci.ip_address || v.ip_address}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                    {ci.environment || v.environment}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {ci.software_name} <span className="font-mono text-slate-500 font-normal">v{ci.version}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{ci.owner || v.owner || "Security Ops"}</td>
                                <td className="px-3 py-2 font-mono text-[10px]">
                                  {ci.pic_email || v.pic_email ? (
                                    <a 
                                      href={`mailto:${ci.pic_email || v.pic_email}`} 
                                      className="text-indigo-600 hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="h-3 w-3 text-indigo-500" />
                                      {ci.pic_email || v.pic_email}
                                    </a>
                                  ) : (
                                    <span className="text-slate-400 italic font-sans">Unassigned</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono bg-red-50 text-red-700 border border-red-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                                    Active Target
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                <Server className="h-3 w-3 text-slate-400 shrink-0" />
                                {v.hostname}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-600">{v.ip_address}</td>
                              <td className="px-3 py-2">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                  {v.environment}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {v.software_name} <span className="font-mono text-slate-500 font-normal">v{v.version}</span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{v.owner || "Security Ops"}</td>
                              <td className="px-3 py-2 font-mono text-[10px]">
                                {v.pic_email ? (
                                  <a href={`mailto:${v.pic_email}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-indigo-500" />
                                    {v.pic_email}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 italic font-sans">Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono bg-red-50 text-red-700 border border-red-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                                  Active Target
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary & Impact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Exploitation Intel
                      </span>
                      <p className="text-slate-800 leading-relaxed font-medium select-text">
                        {v.summary}
                      </p>
                      <p className="text-slate-500 text-[11px] leading-relaxed select-text">
                        <strong>Affected CPE:</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-800 select-all">{v.affected_cpe}</code>
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-xl bg-red-50/50 border border-red-100 p-3">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <Cpu className="h-3 w-3 text-red-600" />
                        Impact Analysis
                      </span>
                      <p className="text-slate-700 text-[11px] leading-normal select-text">
                        {v.impact_analysis || "Exploitation allows remote administrative bypass. Immediate memory disclosure or control hijack risk."}
                      </p>
                    </div>
                  </div>

                  {/* Technical Steps & Workaround Details */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-slate-400" />
                      Immediate Technical Workaround Steps
                    </span>
                    <div className="rounded-xl border border-slate-200 bg-slate-900 p-3.5 space-y-2 text-[11px] font-mono leading-relaxed text-slate-200 select-text">
                      <p className="text-amber-300 font-bold mb-1 uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Critical Workaround Directives
                      </p>
                      <p>{v.mitigation || "Disable affected services, bind host process exclusively to localhost interfaces, and apply strict firewall access policies."}</p>
                      
                      <div className="mt-3 bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                        <span className="text-[9px] font-bold text-slate-400 block mb-1 uppercase tracking-widest">Linux / Docker Mitigation CLI</span>
                        <code className="text-emerald-400 break-all select-all block">
                          {v.software_name.toLowerCase().includes("apache") 
                            ? "docker exec -it cve-tracker-ui sed -i 's/LoadModule proxy_module/#LoadModule proxy_module/g' /etc/apache2/httpd.conf && docker restart cve-tracker-ui"
                            : "docker exec -it cve-tracker-ui openssl ciphers -v | grep TLSv1.3 # verify active cipher suits"}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Action Buttons & Agent Logs */}
                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Remediation Status</span>
                        <span className="text-[11px] text-slate-600 font-medium">
                          {isSuccess 
                            ? "Secured by Autonomous Virtual Patching" 
                            : isPatching 
                              ? "Patching in progress..." 
                              : "Requires immediate attention"}
                        </span>
                      </div>

                      {isSuccess ? (
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider font-mono">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Mitigated
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (onDeployAgent) {
                              onDeployAgent(v);
                            } else {
                              handleRunPatchAgent(v);
                            }
                          }}
                          disabled={!canEdit || isPatching}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-xs font-bold text-white py-2 px-4 uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                        >
                          <Play className={`h-3.5 w-3.5 ${isPatching ? "animate-spin" : ""}`} />
                          {isPatching ? "Running AI Patch Agent..." : "⚡ Deploy AI Patch Agent"}
                        </button>
                      )}
                    </div>

                    {/* Scrolling terminal output */}
                    {(isPatching || logs.length > 0) && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 space-y-1 font-mono text-[10px] text-slate-300 max-h-44 overflow-y-auto mt-2 select-text">
                        <div className="border-b border-slate-800 pb-1.5 mb-2 flex justify-between items-center">
                          <span className="text-slate-400 uppercase tracking-widest font-bold text-[8px] flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                            Live Virtual Patch Terminal logs
                          </span>
                          <span className="text-[8px] text-slate-500">Secure Protocol v1.4</span>
                        </div>
                        {logs.map((log, i) => (
                          <div 
                            key={i} 
                            className={
                              log.startsWith("[FATAL]") 
                                ? "text-red-400 font-semibold" 
                                : log.startsWith("[SYSTEM]") 
                                  ? "text-slate-400" 
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

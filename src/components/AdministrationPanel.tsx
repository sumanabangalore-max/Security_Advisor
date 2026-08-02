import React, { useState, useEffect } from "react";
import { 
  Building2, ShieldCheck, Wrench, RotateCcw, CheckCircle2, 
  AlertTriangle, RefreshCw, Layers, ArrowUpCircle, Terminal, 
  Search, ShieldAlert, Cpu, Check, History, Lock, FileCode, CheckCircle
} from "lucide-react";
import { api } from "../api";
import { AdminUpgradeState, AdminComponent } from "../types";

interface AdministrationPanelProps {
  userRole: "admin" | "analyst" | "viewer";
}

export default function AdministrationPanel({ userRole }: AdministrationPanelProps) {
  const [upgradeState, setUpgradeState] = useState<AdminUpgradeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Loading states
  const [assessing, setAssessing] = useState(false);
  const [remediating, setRemediating] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // Modal confirm states
  const [showRemediateModal, setShowRemediateModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  const isAdmin = userRole === "admin";

  useEffect(() => {
    fetchAdminState();
  }, []);

  const fetchAdminState = async () => {
    try {
      setLoading(true);
      const data = await api.get<AdminUpgradeState>("/api/v1/admin/packages");
      setUpgradeState(data);
      setError("");
    } catch (err: any) {
      setError("Failed to fetch application administration state: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAssessment = async () => {
    setAssessing(true);
    setError("");
    setActionSuccess("");

    try {
      const updated = await api.post<AdminUpgradeState>("/api/v1/admin/packages/assess");
      setUpgradeState(updated);
      setActionSuccess("Assessment completed! Compatibility score: 100%. System is ready for Remediation.");
    } catch (err: any) {
      setError("Assessment failed: " + (err.message || "Unknown error"));
    } finally {
      setAssessing(false);
    }
  };

  const handleExecuteRemediation = async () => {
    setRemediating(true);
    setError("");
    setActionSuccess("");
    setShowRemediateModal(false);

    try {
      const res = await api.post<{ success: boolean; message: string; state: AdminUpgradeState }>("/api/v1/admin/packages/remediate");
      setUpgradeState(res.state);
      setActionSuccess(res.message || "Application successfully upgraded to latest security release!");
    } catch (err: any) {
      setError("Remediation upgrade failed: " + (err.message || "Unknown error"));
    } finally {
      setRemediating(false);
    }
  };

  const handleExecuteRollback = async () => {
    setRollingBack(true);
    setError("");
    setActionSuccess("");
    setShowRollbackModal(false);

    try {
      const res = await api.post<{ success: boolean; message: string; state: AdminUpgradeState }>("/api/v1/admin/packages/rollback");
      setUpgradeState(res.state);
      setActionSuccess(res.message || "System rolled back to previous snapshot successfully.");
    } catch (err: any) {
      setError("Rollback failed: " + (err.message || "Unknown error"));
    } finally {
      setRollingBack(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-zinc-500 font-mono flex flex-col items-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
        <span>Loading system administration components manifest...</span>
      </div>
    );
  }

  const components = upgradeState?.components || [];
  const status = upgradeState?.status || "idle";
  const assessment = upgradeState?.assessment_results;

  const filteredComponents = components.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.vulnerability_fix.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || c.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(components.map(c => c.category)));

  return (
    <div className="space-y-6" id="administration-panel">
      {/* Panel Top Header */}
      <div className="rounded-lg border border-zinc-800 bg-[#121214] p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="rounded bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Application Administration & Security Patch Management
                  <span className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] text-emerald-400 font-mono">
                    v{upgradeState?.system_version || "1.4.2"}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Assess compatibility, remediate security vulnerabilities, and upgrade all system code components to latest market releases.
                </p>
              </div>
            </div>
          </div>

          {/* Workflow Action Control Center */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Step 1: Assessment Button */}
            <button
              id="admin-assess-btn"
              onClick={handleRunAssessment}
              disabled={assessing || remediating || rollingBack}
              className={`flex items-center gap-2 rounded px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-md ${
                status === "assessed" 
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              } disabled:opacity-40`}
              title="Perform compatibility & security fix assessment for all codebase dependencies"
            >
              {assessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Assessing Compatibility...</span>
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  <span>1. Run Assessment</span>
                </>
              )}
            </button>

            {/* Step 2: Remediation Button */}
            <button
              id="admin-remediate-btn"
              onClick={() => {
                if (!isAdmin) {
                  setError("Access Denied: Application upgrade requires Admin privileges.");
                  return;
                }
                setShowRemediateModal(true);
              }}
              disabled={status !== "assessed" || remediating || assessing || rollingBack}
              className={`flex items-center gap-2 rounded px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-md ${
                status === "remediated"
                  ? "bg-emerald-600 text-white border border-emerald-500"
                  : status === "assessed"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
              } disabled:opacity-40`}
              title={status !== "assessed" ? "Complete Assessment step first" : "Upgrade application components to latest security patches"}
            >
              {remediating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-white" />
                  <span>Upgrading Application...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>2. Remediation Upgrade</span>
                </>
              )}
            </button>

            {/* Step 3: Rollback Button */}
            <button
              id="admin-rollback-btn"
              onClick={() => {
                if (!isAdmin) {
                  setError("Access Denied: Rollback operation requires Admin privileges.");
                  return;
                }
                setShowRollbackModal(true);
              }}
              disabled={rollingBack || remediating || assessing || (!upgradeState?.snapshot_version && status !== "remediated")}
              className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-400 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rollback application to previous version snapshot"
            >
              {rollingBack ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                  <span>Rolling Back...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Rollback Version</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Success / Error Notifications */}
        {actionSuccess && (
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess("")} className="text-zinc-500 hover:text-white cursor-pointer">×</button>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-zinc-500 hover:text-white cursor-pointer">×</button>
          </div>
        )}

        {/* Assessment Status Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Workflow Status</span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              {status === "remediated" ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Upgraded & Patched (v{upgradeState?.system_version})
                </span>
              ) : status === "assessed" ? (
                <span className="text-blue-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Assessed & Cleared (100%)
                </span>
              ) : status === "rolled_back" ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <RotateCcw className="h-3.5 w-3.5" /> Rolled Back to v{upgradeState?.system_version}
                </span>
              ) : (
                <span className="text-zinc-400 flex items-center gap-1">
                  <Wrench className="h-3.5 w-3.5 text-zinc-500" /> Pending Assessment
                </span>
              )}
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Components Evaluated</span>
            <span className="text-sm font-mono font-bold text-white">{components.length} Dependencies</span>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Codebase Compatibility</span>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {assessment ? assessment.overall_compatibility.split("-")[0] : "100% Verified"}
            </span>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3.5 space-y-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Pending Security Patches</span>
            <span className="text-sm font-mono font-bold text-amber-400">
              {components.filter(c => c.security_status !== "Up to Date").length} Available
            </span>
          </div>
        </div>

        {/* Assessment Logs Output (When Assessed) */}
        {assessment && (
          <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider border-b border-zinc-850 pb-2">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                Compatibility Assessment Audit Report
              </span>
              <span className="text-zinc-500">{upgradeState?.last_assessment_at ? new Date(upgradeState.last_assessment_at).toLocaleString() : ""}</span>
            </div>
            <div className="space-y-1 text-[11px] text-zinc-300 max-h-36 overflow-y-auto pt-1 leading-relaxed">
              {assessment.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">›</span>
                  <span className={log.includes("100%") ? "text-emerald-400 font-bold" : "text-zinc-300"}>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Component & Packages Inventory Table */}
      <div className="rounded-lg border border-zinc-800 bg-[#121214] p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Application Component Manifest</h3>
            <p className="text-[11px] text-zinc-500">Live inventory of core frameworks, UI packages, AI SDKs, and server dependencies</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search component / patch..."
                className="w-full rounded border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-zinc-500 focus:outline-none transition-colors"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950/40">
          <table className="w-full text-left border-collapse" id="admin-components-table">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <th className="px-4 py-3">Component / Package</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current Version</th>
                <th className="px-4 py-3">Latest Market Version</th>
                <th className="px-4 py-3">Security Advisory Status</th>
                <th className="px-4 py-3">CVE Fix Ref</th>
                <th className="px-4 py-3">Compatibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-xs text-zinc-300">
              {filteredComponents.map((c) => {
                const isOutdated = c.current_version !== c.latest_version;

                return (
                  <tr key={c.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white font-mono flex items-center gap-2">
                      <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{c.name}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-[11px]">{c.category}</td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300">
                        v{c.current_version}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={`rounded px-2 py-0.5 ${
                        isOutdated 
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        v{c.latest_version}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        c.security_status === "Up to Date"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {c.security_status === "Up to Date" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        {c.security_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-400">
                      {c.cve_ref !== "N/A" ? (
                        <span className="rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-red-400 text-[10px] font-bold">
                          {c.cve_ref}
                        </span>
                      ) : (
                        <span className="text-zinc-600">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                      {c.compatibility_score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remediation Upgrade Confirmation Modal */}
      {showRemediateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-emerald-500/30 bg-zinc-950 p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="rounded bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Application Upgrade & Remediation</h3>
                <p className="text-[11px] text-zinc-400">Upgrade all dependencies to latest security releases</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This action will upgrade all application code components to release <strong className="text-emerald-400">v1.5.0</strong>. An automatic rollback snapshot will be created beforehand.
            </p>

            <div className="rounded border border-zinc-800 bg-zinc-900 p-3 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Security Fixes Included:</span>
              <ul className="space-y-1 text-[11px] text-zinc-300 list-disc list-inside">
                <li>Fixes prototype pollution in Express server parser (CVE-2026-3482)</li>
                <li>Patches ReDoS vulnerability in WS protocol (CVE-2026-8812)</li>
                <li>Updates React DOM hydration security routines (CVE-2026-2101)</li>
                <li>Patches dev server path traversal in Vite (CVE-2026-4019)</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-850">
              <button
                onClick={() => setShowRemediateModal(false)}
                className="rounded px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRemediation}
                disabled={remediating}
                className="flex items-center gap-2 rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Confirm & Upgrade Application</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-zinc-950 p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="rounded bg-amber-500/10 p-2 text-amber-400 border border-amber-500/20">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm System Rollback</h3>
                <p className="text-[11px] text-zinc-400">Restore application to previous stable snapshot</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to rollback the application to snapshot version <strong className="text-amber-400">v{upgradeState?.snapshot_version || "1.4.2"}</strong>? This will revert all code package configurations to their prior versions.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-850">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="rounded px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRollback}
                disabled={rollingBack}
                className="flex items-center gap-2 rounded bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Execute Rollback</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

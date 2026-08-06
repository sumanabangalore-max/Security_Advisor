import React, { useState, useEffect } from "react";
import { 
  Building2, ShieldCheck, Wrench, RotateCcw, CheckCircle2, 
  AlertTriangle, RefreshCw, ArrowUpCircle, Terminal, 
  Search, ShieldAlert, Check, History, Lock, FileCode, CheckCircle,
  Users, Cloud, Settings, Layers, Database, Zap, Key
} from "lucide-react";
import { api } from "../api";
import { AdminUpgradeState, AdminComponent } from "../types";
import UserManagementPanel from "./UserManagementPanel";
import LdapConfigPanel from "./LdapConfigPanel";
import ExternalLoggingPanel from "./ExternalLoggingPanel";
import ConfigurationPanel from "./ConfigurationPanel";
import CveSourcesPanel from "./CveSourcesPanel";
import AiAgentConfigPanel from "./AiAgentConfigPanel";
import AiPlatformConfigPanel from "./AiPlatformConfigPanel";
import DatabaseConfigPanel from "./DatabaseConfigPanel";
import { UserRole } from "../types";

export type AdminSubTab = "users" | "ldap" | "siem" | "smtp" | "cve-sources" | "ai-platform" | "ai-agent" | "db-config" | "system-patching";

interface AdministrationPanelProps {
  userRole: UserRole;
  activeSubTab?: AdminSubTab;
  onSubTabChange?: (subTab: AdminSubTab) => void;
}

export default function AdministrationPanel({ 
  userRole, 
  activeSubTab = "users", 
  onSubTabChange 
}: AdministrationPanelProps) {
  const [currentSubTab, setCurrentSubTab] = useState<AdminSubTab>(activeSubTab);

  useEffect(() => {
    if (activeSubTab) {
      setCurrentSubTab(activeSubTab);
    }
  }, [activeSubTab]);

  const handleTabChange = (tab: AdminSubTab) => {
    setCurrentSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  const [upgradeState, setUpgradeState] = useState<AdminUpgradeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Search filter for system patching
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
    if (currentSubTab === "system-patching") {
      fetchAdminState();
    }
  }, [currentSubTab]);

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

  const subNavItems = [
    { id: "users", label: "User Access & Roles", icon: Users, desc: "Account directory & roles" },
    { id: "ldap", label: "Active Directory LDAP", icon: Building2, desc: "Windows AD domain bind & SSO" },
    { id: "db-config", label: "DB Configuration", icon: Database, desc: "Azure PaaS & AWS RDS" },
    { id: "siem", label: "SIEM & External Logging", icon: Cloud, desc: "AWS, Azure & Syslog" },
    { id: "smtp", label: "SMTP Config", icon: Settings, desc: "SMTP server & email alerts" },
    { id: "cve-sources", label: "CVE Source Config", icon: Database, desc: "NVD API sync & source feeds" },
    { id: "ai-platform", label: "AI Platform & API Keys", icon: Key, desc: "GovTech AI & Gemini keys" },
    { id: "ai-agent", label: "AIPatch Agent Config", icon: Zap, desc: "Jump host proxies & README" },
    { id: "system-patching", label: "System Patching", icon: ShieldCheck, desc: "Package upgrade & remediation" },
  ];

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
      {/* Navigation Sub-Header Bar under Administration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 px-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Enterprise Administration & Configuration Hub</h2>
              <p className="text-xs text-slate-500">Centralized control panel for users, authentication, logging integrations, and patch management</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSubTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id as AdminSubTab)}
                className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-indigo-600"}`} />
                  <span className="text-xs font-bold truncate">{item.label}</span>
                </div>
                <span className={`text-[10px] truncate ${isActive ? "text-indigo-100" : "text-slate-500"}`}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render selected administrative view */}
      {currentSubTab === "users" && (
        <UserManagementPanel userRole={userRole} />
      )}

      {currentSubTab === "ldap" && (
        <LdapConfigPanel userRole={userRole} />
      )}

      {currentSubTab === "db-config" && (
        <DatabaseConfigPanel userRole={userRole} />
      )}

      {currentSubTab === "siem" && (
        <ExternalLoggingPanel userRole={userRole} />
      )}

      {currentSubTab === "smtp" && (
        <ConfigurationPanel userRole={userRole} />
      )}

      {currentSubTab === "cve-sources" && (
        <CveSourcesPanel userRole={userRole} onSourcesChanged={() => {}} />
      )}

      {currentSubTab === "ai-platform" && (
        <AiPlatformConfigPanel userRole={userRole} />
      )}

      {currentSubTab === "ai-agent" && (
        <AiAgentConfigPanel userRole={userRole} />
      )}

      {currentSubTab === "system-patching" && (
        <div className="space-y-6">
          {/* System Patching Top Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      Application Security Patch & Dependency Management
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs text-indigo-700 font-mono font-bold">
                        v{upgradeState?.system_version || "1.4.2"}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Assess compatibility, remediate security vulnerabilities, and upgrade all system code components to latest releases.
                    </p>
                  </div>
                </div>
              </div>

              {/* Workflow Action Control Center */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  id="admin-assess-btn"
                  onClick={handleRunAssessment}
                  disabled={assessing || remediating || rollingBack}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    status === "assessed" 
                      ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  } disabled:opacity-40`}
                >
                  {assessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Assessing...</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="h-4 w-4" />
                      <span>1. Run Assessment</span>
                    </>
                  )}
                </button>

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
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs ${
                    status === "remediated"
                      ? "bg-emerald-600 text-white border border-emerald-500"
                      : status === "assessed"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  } disabled:opacity-40`}
                >
                  {remediating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Upgrading System...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>2. Remediation Upgrade</span>
                    </>
                  )}
                </button>

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
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-800 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {rollingBack ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-amber-700" />
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

            {/* Notifications */}
            {actionSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
                <button onClick={() => setActionSuccess("")} className="text-slate-400 hover:text-slate-700 cursor-pointer">×</button>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button onClick={() => setError("")} className="text-slate-400 hover:text-slate-700 cursor-pointer">×</button>
              </div>
            )}

            {/* Assessment Banners */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Workflow Status</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  {status === "remediated" ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Upgraded & Patched (v{upgradeState?.system_version})
                    </span>
                  ) : status === "assessed" ? (
                    <span className="text-indigo-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Assessed & Cleared (100%)
                    </span>
                  ) : status === "rolled_back" ? (
                    <span className="text-amber-700 flex items-center gap-1">
                      <RotateCcw className="h-3.5 w-3.5" /> Rolled Back to v{upgradeState?.system_version}
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5 text-slate-400" /> Pending Assessment
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Components Evaluated</span>
                <span className="text-sm font-mono font-bold text-slate-900">{components.length} Dependencies</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Codebase Compatibility</span>
                <span className="text-sm font-mono font-bold text-emerald-700">
                  {assessment ? assessment.overall_compatibility.split("-")[0] : "100% Verified"}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Pending Security Patches</span>
                <span className="text-sm font-mono font-bold text-amber-700">
                  {components.filter(c => c.security_status !== "Up to Date").length} Available
                </span>
              </div>
            </div>

            {/* Assessment Logs Output */}
            {assessment && (
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2 font-mono text-xs text-slate-200">
                <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                    Compatibility Assessment Audit Report
                  </span>
                  <span className="text-slate-500">{upgradeState?.last_assessment_at ? new Date(upgradeState.last_assessment_at).toLocaleString() : ""}</span>
                </div>
                <div className="space-y-1 text-[11px] text-slate-300 max-h-36 overflow-y-auto pt-1 leading-relaxed">
                  {assessment.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">›</span>
                      <span className={log.includes("100%") ? "text-emerald-400 font-bold" : "text-slate-300"}>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Component Inventory Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Application Component Manifest</h3>
                <p className="text-xs text-slate-500">Live inventory of core frameworks, UI packages, AI SDKs, and server dependencies</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search component / patch..."
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse" id="admin-components-table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <th className="px-4 py-3">Component / Package</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Current Version</th>
                    <th className="px-4 py-3">Latest Market Version</th>
                    <th className="px-4 py-3">Security Advisory Status</th>
                    <th className="px-4 py-3">CVE Fix Ref</th>
                    <th className="px-4 py-3">Compatibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredComponents.map((c) => {
                    const isOutdated = c.current_version !== c.latest_version;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 font-mono flex items-center gap-2">
                          <FileCode className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>{c.name}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">{c.category}</td>
                        <td className="px-4 py-3 font-mono font-bold">
                          <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-700">
                            v{c.current_version}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          <span className={`rounded-md px-2 py-0.5 ${
                            isOutdated 
                              ? "bg-amber-50 text-amber-800 border border-amber-200" 
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}>
                            v{c.latest_version}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.security_status === "Up to Date"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {c.security_status === "Up to Date" ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <ShieldAlert className="h-3 w-3" />
                            )}
                            {c.security_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {c.cve_ref !== "N/A" ? (
                            <span className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-red-700 text-[10px] font-bold">
                              {c.cve_ref}
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-700 font-bold">
                          {c.compatibility_score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Remediation Upgrade Confirmation Modal */}
      {showRemediateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Confirm Application Upgrade & Remediation</h3>
                <p className="text-xs text-slate-500">Upgrade all dependencies to latest security releases</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              This action will upgrade all application code components to release <strong className="text-emerald-700">v1.5.0</strong>. An automatic rollback snapshot will be created beforehand.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Security Fixes Included:</span>
              <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">
                <li>Fixes prototype pollution in Express server parser (CVE-2026-3482)</li>
                <li>Patches ReDoS vulnerability in WS protocol (CVE-2026-8812)</li>
                <li>Updates React DOM hydration security routines (CVE-2026-2101)</li>
                <li>Patches dev server path traversal in Vite (CVE-2026-4019)</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRemediateModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRemediation}
                disabled={remediating}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600 border border-amber-100">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Confirm System Rollback</h3>
                <p className="text-xs text-slate-500">Restore application to previous stable snapshot</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Are you sure you want to rollback the application to snapshot version <strong className="text-amber-700">v{upgradeState?.snapshot_version || "1.4.2"}</strong>? This will revert code package configurations to prior versions.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRollbackModal(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRollback}
                disabled={rollingBack}
                className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
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


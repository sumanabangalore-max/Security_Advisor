import React, { useState, useEffect } from "react";
import { 
  Server, Shield, Terminal, CheckCircle2, AlertTriangle, 
  RefreshCw, Cpu, Key, Lock, Network, HelpCircle, FileText,
  Check, Edit3, Save, Radio, ExternalLink, Zap
} from "lucide-react";
import { api } from "../api";
import { JumpHostConfig, UserRole } from "../types";

interface AiAgentConfigPanelProps {
  userRole: UserRole;
}

const DEFAULT_JUMP_HOSTS: JumpHostConfig[] = [
  {
    environment: "Dev",
    host: "jumphost-dev.corp.internal",
    ip_address: "10.110.0.10",
    port: 22,
    user: "aipatch-svc-dev",
    auth_method: "SSH RSA Key",
    remote_ci_cmd: "/opt/aipatch/bin/deploy-remote --env Dev",
    status: "Healthy",
    target_vms_count: 12
  },
  {
    environment: "SIT",
    host: "jumphost-sit.corp.internal",
    ip_address: "10.120.0.10",
    port: 22,
    user: "aipatch-svc-sit",
    auth_method: "SSH RSA Key",
    remote_ci_cmd: "/opt/aipatch/bin/deploy-remote --env SIT",
    status: "Healthy",
    target_vms_count: 8
  },
  {
    environment: "UAT",
    host: "jumphost-uat.corp.internal",
    ip_address: "10.130.0.10",
    port: 22,
    user: "aipatch-svc-uat",
    auth_method: "SSH RSA Key",
    remote_ci_cmd: "/opt/aipatch/bin/deploy-remote --env UAT",
    status: "Healthy",
    target_vms_count: 6
  },
  {
    environment: "ORT",
    host: "jumphost-ort.corp.internal",
    ip_address: "10.135.0.10",
    port: 22,
    user: "aipatch-svc-ort",
    auth_method: "SSH RSA Key",
    remote_ci_cmd: "/opt/aipatch/bin/deploy-remote --env ORT",
    status: "Healthy",
    target_vms_count: 4
  },
  {
    environment: "Production",
    host: "jumphost-prod.corp.internal",
    ip_address: "10.140.0.10",
    port: 22,
    user: "aipatch-svc-prod",
    auth_method: "SSH RSA Key & MFA",
    remote_ci_cmd: "/opt/aipatch/bin/deploy-remote --env Production",
    status: "Healthy",
    target_vms_count: 24
  }
];

export default function AiAgentConfigPanel({ userRole }: AiAgentConfigPanelProps) {
  const [jumpHosts, setJumpHosts] = useState<JumpHostConfig[]>(DEFAULT_JUMP_HOSTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingEnv, setTestingEnv] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ env: string; message: string; success: boolean; details?: any } | null>(null);
  const [editEnv, setEditEnv] = useState<string | null>(null);
  const [editedHost, setEditedHost] = useState<JumpHostConfig | null>(null);
  const [activeTab, setActiveTab] = useState<"jump-hosts" | "readme">("jump-hosts");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchJumpHosts();
  }, []);

  const fetchJumpHosts = async () => {
    try {
      setLoading(true);
      const data = await api.get<JumpHostConfig[]>("/api/v1/aipatch/jump-hosts");
      if (Array.isArray(data) && data.length > 0) {
        setJumpHosts(data);
      }
    } catch {
      // Fall back to default initialized jump hosts
      setJumpHosts(DEFAULT_JUMP_HOSTS);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async (updatedHosts?: JumpHostConfig[]) => {
    if (!canEdit) return;
    const listToSave = updatedHosts || jumpHosts;
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await api.put("/api/v1/aipatch/jump-hosts", { hosts: listToSave });
      setJumpHosts(listToSave);
      setSuccessMsg("AIPatch Agent Jump Host configurations saved successfully.");
      setEditEnv(null);
    } catch (err: any) {
      setErrorMsg("Failed to save configuration: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (item: JumpHostConfig) => {
    setEditEnv(item.environment);
    setEditedHost({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editedHost) return;
    const nextList = jumpHosts.map(h => h.environment === editedHost.environment ? editedHost : h);
    handleSaveAll(nextList);
  };

  const handleTestConnection = async (item: JumpHostConfig) => {
    setTestingEnv(item.environment);
    setTestResult(null);
    try {
      const res = await api.post<any>("/api/v1/aipatch/jump-hosts/test", {
        environment: item.environment,
        host: item.host,
        port: item.port,
        user: item.user
      });
      setTestResult({
        env: item.environment,
        message: res.message || `Connected to ${item.host}:${item.port} successfully!`,
        success: true,
        details: res
      });
    } catch (err: any) {
      setTestResult({
        env: item.environment,
        message: `Failed to connect to ${item.host}: ${err.message || "Connection timed out"}`,
        success: false
      });
    } finally {
      setTestingEnv(null);
    }
  };

  return (
    <div className="space-y-6" id="ai-agent-config-panel">
      {/* Top Banner Header */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-600 p-3 text-white shadow-sm shrink-0">
              <Zap className="h-6 w-6 text-indigo-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-extrabold px-2.5 py-0.5 uppercase tracking-wider font-mono">
                  AIPatch Agent Subsystem
                </span>
                <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Agent Proxy Active
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">
                AIPatch Agent Remote CI & Jump Host Controller
              </h2>
              <p className="text-xs text-indigo-200/80 leading-relaxed max-w-2xl mt-1">
                Configure dedicated environment Jump Hosts (Dev, SIT, UAT, ORT, Production) for remote SSH tunneling and automated CI patch deployment across target instances.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab("jump-hosts")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "jump-hosts"
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900/80 border border-indigo-700/50"
              }`}
            >
              <Server className="h-4 w-4" />
              Jump Hosts ({jumpHosts.length})
            </button>

            <button
              onClick={() => setActiveTab("readme")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "readme"
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900/80 border border-indigo-700/50"
              }`}
            >
              <FileText className="h-4 w-4" />
              Agent README & Ports
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === "jump-hosts" ? (
        <div className="space-y-6">
          {/* Jump Hosts Environment Cards */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="h-4 w-4 text-indigo-600" />
                Configured Environment Jump Hosts
              </h3>
              <p className="text-xs text-slate-500">
                Each target environment routes remote AIPatch CI commands through its dedicated Jump Host SSH proxy.
              </p>
            </div>

            {canEdit && (
              <button
                onClick={() => handleSaveAll()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-4 uppercase tracking-wider shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Configs"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {jumpHosts.map((jh) => {
              const isEditing = editEnv === jh.environment;
              const isTesting = testingEnv === jh.environment;
              const isThisTestRes = testResult && testResult.env === jh.environment;

              return (
                <div 
                  key={jh.environment}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-indigo-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase font-mono tracking-wider border ${
                        jh.environment === "Production"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : jh.environment === "UAT" || jh.environment === "ORT"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}>
                        {jh.environment} Environment
                      </span>
                      <div className="h-4 w-px bg-slate-200" />
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        {jh.host} ({jh.ip_address})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {jh.status || "Healthy"}
                      </span>

                      <button
                        onClick={() => handleTestConnection(jh)}
                        disabled={isTesting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                        title="Test SSH tunnel and agent daemon connectivity"
                      >
                        <RefreshCw className={`h-3 w-3 text-indigo-600 ${isTesting ? "animate-spin" : ""}`} />
                        {isTesting ? "Testing..." : "Test Tunnel"}
                      </button>

                      {canEdit && !isEditing && (
                        <button
                          onClick={() => handleStartEdit(jh)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form fields / View mode */}
                  {isEditing && editedHost ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jump Host FQDN</label>
                        <input
                          type="text"
                          value={editedHost.host}
                          onChange={(e) => setEditedHost({ ...editedHost, host: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IP Address</label>
                        <input
                          type="text"
                          value={editedHost.ip_address}
                          onChange={(e) => setEditedHost({ ...editedHost, ip_address: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SSH Port</label>
                        <input
                          type="number"
                          value={editedHost.port}
                          onChange={(e) => setEditedHost({ ...editedHost, port: parseInt(e.target.value) || 22 })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Service User</label>
                        <input
                          type="text"
                          value={editedHost.user}
                          onChange={(e) => setEditedHost({ ...editedHost, user: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remote CI Command / Script</label>
                        <input
                          type="text"
                          value={editedHost.remote_ci_cmd}
                          onChange={(e) => setEditedHost({ ...editedHost, remote_ci_cmd: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-end justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditEnv(null)}
                          className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-1.5 uppercase cursor-pointer flex items-center gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono text-slate-700">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">SSH Target</span>
                        <span className="text-slate-900 font-semibold">{jh.user}@{jh.host}:{jh.port}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Authentication</span>
                        <span className="text-slate-900 font-semibold flex items-center gap-1">
                          <Key className="h-3 w-3 text-indigo-600" />
                          {jh.auth_method}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Remote CI Execution Directive</span>
                        <code className="bg-slate-100 border border-slate-200 text-indigo-700 px-2 py-0.5 rounded text-[11px] block truncate">
                          {jh.remote_ci_cmd}
                        </code>
                      </div>
                    </div>
                  )}

                  {/* Connection Test Output Banner */}
                  {isThisTestRes && (
                    <div className={`rounded-xl p-3.5 text-xs font-mono border space-y-1 animate-fadeIn ${
                      testResult.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-red-50 border-red-200 text-red-900"
                    }`}>
                      <div className="flex items-center gap-2 font-bold font-sans">
                        {testResult.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                        Jump Host Connection Test Results ({jh.environment})
                      </div>
                      <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                      {testResult.details && (
                        <div className="flex gap-4 text-[10px] text-emerald-700 pt-1 border-t border-emerald-200 font-mono">
                          <span>Tunnel: {testResult.details.ssh_tunnel}</span>
                          <span>Latency: {testResult.details.latency_ms}ms</span>
                          <span>Daemon: {testResult.details.agent_daemon}</span>
                          <span>Ports: [{testResult.details.open_ports?.join(", ")}]</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agent Readme & Required Ports Guide */
        <div className="space-y-6" id="aipatch-agent-readme">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700 uppercase tracking-wider font-mono mb-2">
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                Technical Prerequisites & README
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                AIPatch Agent Remote CI Architecture & Required Ports
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-3xl mt-1">
                This document specifies the network firewall port rules, system daemon requirements, and remote execution permissions necessary to operate AIPatch remote remediation via Jump Hosts across Dev, SIT, UAT, ORT, and Production VM clusters.
              </p>
            </div>

            {/* Required Ports Grid */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="h-4 w-4 text-indigo-600" />
                1. Required Network Ports & Security Protocols
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Port</th>
                      <th className="px-4 py-3">Protocol</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Service Purpose</th>
                      <th className="px-4 py-3">Firewall Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">22</td>
                      <td className="px-4 py-3">TCP / SSH</td>
                      <td className="px-4 py-3 text-slate-700 font-bold">Inbound to Jump Host</td>
                      <td className="px-4 py-3 font-sans text-slate-700">SSH Tunneling & RSA-4096 Key authentication for non-interactive commands</td>
                      <td className="px-4 py-3 font-sans text-slate-500">SecAdvisor App -&gt; Jump Host</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">8443 / 443</td>
                      <td className="px-4 py-3">TCP / HTTPS</td>
                      <td className="px-4 py-3 text-slate-700 font-bold">Bi-directional</td>
                      <td className="px-4 py-3 font-sans text-slate-700">AIPatch Control Daemon REST/gRPC API & live terminal streaming</td>
                      <td className="px-4 py-3 font-sans text-slate-500">Jump Host &lt;-&gt; Target VM</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">5985 / 5986</td>
                      <td className="px-4 py-3">TCP / WinRM</td>
                      <td className="px-4 py-3 text-slate-700 font-bold">Outbound from Jump Host</td>
                      <td className="px-4 py-3 font-sans text-slate-700">Windows Remote Management execution for Windows Server target hosts</td>
                      <td className="px-4 py-3 font-sans text-slate-500">Jump Host -&gt; Win Server Target</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-indigo-600">8080 / 9000</td>
                      <td className="px-4 py-3">TCP / HTTP</td>
                      <td className="px-4 py-3 text-slate-700 font-bold">Inbound to CI Runner</td>
                      <td className="px-4 py-3 font-sans text-slate-700">Remote CI/CD Webhook trigger & automated pipeline execution engine</td>
                      <td className="px-4 py-3 font-sans text-slate-500">Jump Host -&gt; CI Pipeline Server</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Required Daemon Services & Prerequisites */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-600" />
                2. Required Background Services & System Configuration
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-600" />
                    aipatch-agentd Systemd Daemon
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    The lightweight background service must be enabled and active on all target host instances (<code className="bg-white px-1.5 py-0.5 rounded border font-mono">systemctl status aipatch-agentd</code>).
                  </p>
                  <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] space-y-1">
                    <p className="text-emerald-400"># Verify Daemon Status</p>
                    <p>sudo systemctl enable aipatch-agentd</p>
                    <p>sudo systemctl start aipatch-agentd</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <span className="font-bold text-slate-900 flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-600" />
                    SSH Authorized Keys & Sudoers Setup
                  </span>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    The service account (<code className="bg-white px-1.5 py-0.5 rounded border font-mono">aipatch-svc-*</code>) requires passwordless SSH key access and passwordless sudo permissions for package managers (<code className="bg-white px-1.5 py-0.5 rounded border font-mono">apt-get</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono">dnf</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono">docker</code>).
                  </p>
                  <div className="bg-slate-900 text-slate-200 p-2.5 rounded-lg font-mono text-[10px] space-y-1">
                    <p className="text-amber-300"># /etc/sudoers.d/aipatch</p>
                    <p>aipatch-svc ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/systemctl</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Overview Diagram */}
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Network className="h-4 w-4 text-indigo-600" />
                3. End-to-End Execution Flow
              </h4>

              <div className="rounded-xl bg-slate-900 text-slate-200 p-4 font-mono text-[11px] leading-relaxed space-y-2">
                <p className="text-indigo-400 font-bold">[SecAdvisor Platform UI]</p>
                <p className="pl-4 text-slate-400">└─► 1. User clicks "Deploy AIPatch Agent" and selects Environment (e.g., SIT)</p>
                <p className="pl-8 text-slate-400">└─► 2. API queries configured SIT Jump Host (jumphost-sit.corp.internal:22)</p>
                <p className="pl-12 text-slate-400">└─► 3. SSH SOCKS5/Direct Tunnel established via RSA key</p>
                <p className="pl-16 text-emerald-400">└─► 4. Triggers remote CI agent on target VM (10.140.0.22)</p>
                <p className="pl-20 text-emerald-300">└─► 5. Vendor patch applied, SHA256 checksum verified & service reloaded</p>
                <p className="pl-24 text-emerald-400 font-bold">└─► 6. Result & live logs returned to Remediation Dashboard (Status: MITIGATED)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

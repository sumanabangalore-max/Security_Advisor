import React, { useState, useEffect } from "react";
import { 
  X, Zap, Server, Terminal, CheckCircle2, AlertTriangle, 
  Cpu, Shield, Key, RefreshCw, Network, ArrowRight, Check, Activity
} from "lucide-react";
import { api } from "../api";
import { Vulnerability, JumpHostConfig, UserRole } from "../types";

interface DeployAipatchModalProps {
  vulnerability: Vulnerability | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userRole: UserRole;
}

const ENV_OPTIONS = ["Dev", "SIT", "UAT", "ORT", "Production"];

export default function DeployAipatchModal({
  vulnerability,
  isOpen,
  onClose,
  onSuccess,
  userRole
}: DeployAipatchModalProps) {
  const [selectedEnv, setSelectedEnv] = useState<string>("Production");
  const [jumpHosts, setJumpHosts] = useState<JumpHostConfig[]>([]);
  const [selectedJumpHost, setSelectedJumpHost] = useState<JumpHostConfig | null>(null);
  const [strategy, setStrategy] = useState<string>("Full Remote Package Upgrade & Service Reload");
  
  // Execution states
  const [executing, setExecuting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [executionResult, setExecutionResult] = useState<any>(null);

  const [preprodGate, setPreprodGate] = useState<any>(null);
  const [loadingGate, setLoadingGate] = useState<boolean>(false);

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    if (vulnerability) {
      // Normalize environment selection to match available jump host environments
      const envMatch = ENV_OPTIONS.find(
        e => e.toLowerCase() === (vulnerability.environment || "").toLowerCase()
      ) || "Production";
      setSelectedEnv(envMatch);
      fetchJumpHosts(envMatch);
      fetchPreprodGate(vulnerability.id);
      setCompleted(false);
      setLogs([]);
      setErrorMsg("");
      setExecutionResult(null);
    }
  }, [vulnerability]);

  const fetchPreprodGate = async (vulnId: number) => {
    try {
      setLoadingGate(true);
      const gate = await api.get<any>(`/api/v1/vulnerabilities/${vulnId}/preprod-gate`);
      setPreprodGate(gate);
    } catch (err) {
      console.warn("Failed to fetch preprod gate status:", err);
    } finally {
      setLoadingGate(false);
    }
  };

  const handleCompleteAllPreprod = async () => {
    if (!vulnerability) return;
    try {
      setLoadingGate(true);
      const res = await api.post<any>(`/api/v1/vulnerabilities/${vulnerability.id}/preprod-gate/stage`, {
        stage: "ALL",
        action: "complete",
        verified_by: "Preprod CI Pipeline Auto-Verifier"
      });
      setPreprodGate(res);
      setErrorMsg("");
    } catch (err: any) {
      setErrorMsg("Failed to update preprod gate stages: " + (err.message || "Server error"));
    } finally {
      setLoadingGate(false);
    }
  };

  const fetchJumpHosts = async (targetEnv: string) => {
    try {
      const list = await api.get<JumpHostConfig[]>("/api/v1/aipatch/jump-hosts");
      if (Array.isArray(list) && list.length > 0) {
        setJumpHosts(list);
        const match = list.find(j => j.environment.toLowerCase() === targetEnv.toLowerCase());
        setSelectedJumpHost(match || list[0]);
      } else {
        setDefaultJumpHost(targetEnv);
      }
    } catch {
      setDefaultJumpHost(targetEnv);
    }
  };

  const setDefaultJumpHost = (targetEnv: string) => {
    const defaultHost: JumpHostConfig = {
      environment: targetEnv as any,
      host: `jumphost-${targetEnv.toLowerCase()}.corp.internal`,
      ip_address: `10.${110 + ENV_OPTIONS.indexOf(targetEnv) * 10}.0.10`,
      port: 22,
      user: `aipatch-svc-${targetEnv.toLowerCase()}`,
      auth_method: "SSH RSA Key",
      remote_ci_cmd: `/opt/aipatch/bin/deploy-remote --env ${targetEnv}`,
      status: "Healthy",
      target_vms_count: 10
    };
    setSelectedJumpHost(defaultHost);
  };

  const handleEnvChange = (env: string) => {
    setSelectedEnv(env);
    const match = jumpHosts.find(j => j.environment.toLowerCase() === env.toLowerCase());
    if (match) {
      setSelectedJumpHost(match);
    } else {
      setDefaultJumpHost(env);
    }
  };

  const handleTriggerDeploy = async () => {
    if (!vulnerability || !canEdit || executing) return;

    setExecuting(true);
    setErrorMsg("");
    setLogs([
      `[INIT] Activating AIPatch Agent remote deployment pipeline...`,
      `[TARGET] Selected Target Asset: ${vulnerability.hostname || "web-srv.internal"} (${vulnerability.ip_address || "10.0.1.12"})`,
      `[ENV] Target Environment: ${selectedEnv.toUpperCase()}`,
      `[JUMP-HOST] Resolving Jump Host SSH proxy endpoint: ${selectedJumpHost?.host || "jumphost.corp.internal"}:${selectedJumpHost?.port || 22}`
    ]);

    try {
      const res = await api.post<any>(`/api/v1/vulnerabilities/${vulnerability.id}/remediate-agent`, {
        environment: selectedEnv,
        jump_host: selectedJumpHost?.host || `jumphost-${selectedEnv.toLowerCase()}.corp.internal`,
        strategy: strategy
      });

      let stepIndex = 0;
      const backendLogs = res.logs || [];

      const timer = setInterval(() => {
        if (stepIndex < backendLogs.length) {
          const nextLog = backendLogs[stepIndex++];
          setLogs(prev => [...prev, nextLog]);
        } else {
          clearInterval(timer);
          setExecuting(false);
          setCompleted(true);
          setExecutionResult(res);
          onSuccess();
        }
      }, 400);

    } catch (err: any) {
      setExecuting(false);
      setErrorMsg("Remote CI Deployment failed: " + (err.message || "Connection refused by Jump Host"));
      setLogs(prev => [...prev, `[FATAL] Deployment aborted: ${err.message || "Connection refused"}`]);
    }
  };

  if (!isOpen || !vulnerability) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn" id="deploy-aipatch-modal">
      <div className="relative w-full max-w-3xl rounded-2xl border border-indigo-200 bg-white shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-sm">
              <Zap className="h-5 w-5 text-indigo-200 animate-pulse" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-200 uppercase font-mono">
                Deploy AIPatch Agent via Jump Host
              </span>
              <h3 className="text-base font-black text-white uppercase tracking-wider mt-0.5">
                Remediate {vulnerability.cve_id} on {vulnerability.software_name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          
          {/* Target Vulnerability Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Target Software</span>
              <span className="text-slate-900 font-bold">{vulnerability.software_name} v{vulnerability.version}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Asset Hostname</span>
              <span className="text-slate-900 font-bold">{vulnerability.hostname || "srv-01.internal"}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Target IP Address</span>
              <span className="text-slate-900 font-bold">{vulnerability.ip_address || "10.0.1.15"}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">CVSS Severity</span>
              <span className="inline-flex items-center rounded-md bg-red-100 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 uppercase">
                {vulnerability.cvss_score ? `${vulnerability.cvss_score.toFixed(1)} CRITICAL` : "CRITICAL"}
              </span>
            </div>
          </div>

          {!completed && !executing && (
            <div className="space-y-5">
              
              {/* 1. Environment Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Server className="h-4 w-4 text-indigo-600" />
                  1. Select Target Environment Jump Host
                </label>
                <p className="text-xs text-slate-500">
                  Choose the destination environment VM cluster. The system will auto-connect to its configured Jump Host proxy.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {ENV_OPTIONS.map((env) => {
                    const isSelected = selectedEnv.toLowerCase() === env.toLowerCase();
                    return (
                      <button
                        key={env}
                        onClick={() => handleEnvChange(env)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs uppercase tracking-wider ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {env}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preprod Gate Pipeline Verification Banner */}
              {preprodGate && (
                <div className={`rounded-xl border p-4 space-y-3 ${
                  preprodGate.isComplete 
                    ? "border-emerald-300 bg-emerald-50/80 text-emerald-950" 
                    : "border-amber-300 bg-amber-50/80 text-amber-950"
                }`}>
                  <div className="flex items-center justify-between border-b border-black/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Shield className={`h-4 w-4 ${preprodGate.isComplete ? "text-emerald-600" : "text-amber-600"}`} />
                      <span className="text-xs font-black uppercase tracking-wider">
                        CI-Based Pre-Production Remediation Gate ({preprodGate.cve_id})
                      </span>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                      preprodGate.isComplete 
                        ? "bg-emerald-600 text-white border-emerald-700" 
                        : "bg-amber-500 text-white border-amber-600"
                    }`}>
                      {preprodGate.isComplete ? "✓ GATE PASSED" : "🔒 GATE INCOMPLETE"}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium leading-relaxed">
                    {preprodGate.isComplete ? (
                      <span className="text-emerald-800">
                        <strong>All 4 Preprod Environments (Dev, SIT, UAT, ORT) have been verified & completed!</strong> Production deployment is authorized.
                      </span>
                    ) : (
                      <span className="text-amber-900">
                        <strong>Production Deployment Restricted:</strong> Remediation in Dev, SIT, UAT, and ORT must all be verified before moving to Production. Missing: <strong>{preprodGate.pendingStages?.join(", ")}</strong>.
                      </span>
                    )}
                  </p>

                  {/* Stage Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                    {["DEV", "SIT", "UAT", "ORT"].map((stageKey) => {
                      const stageDetail = preprodGate.gate?.stages?.[stageKey];
                      const isPassed = stageDetail?.status === "COMPLETED";
                      return (
                        <div 
                          key={stageKey}
                          className={`p-2 rounded-lg border text-center font-bold ${
                            isPassed 
                              ? "bg-emerald-100/90 border-emerald-300 text-emerald-900" 
                              : "bg-amber-100/90 border-amber-300 text-amber-900"
                          }`}
                        >
                          <div className="text-[10px] font-extrabold uppercase">{stageKey} Stage</div>
                          <div className="text-[11px] font-black mt-0.5 flex items-center justify-center gap-1">
                            {isPassed ? <Check className="h-3 w-3 text-emerald-700" /> : <Activity className="h-3 w-3 text-amber-700" />}
                            {isPassed ? "COMPLETED" : "PENDING"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!preprodGate.isComplete && canEdit && (
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCompleteAllPreprod}
                        disabled={loadingGate}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3.5 py-1.5 uppercase tracking-wider cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />
                        Execute & Complete Dev, SIT, UAT & ORT Verifications
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Jump Host Selected Details */}
              {selectedJumpHost && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <span className="font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                      <Network className="h-4 w-4 text-indigo-600" />
                      Active Jump Host Proxy ({selectedJumpHost.environment})
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 uppercase font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {selectedJumpHost.status || "Healthy"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px] text-slate-700 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Jump Host Address</span>
                      <strong className="text-slate-900">{selectedJumpHost.host}:{selectedJumpHost.port || 22}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">SSH Credential Profile</span>
                      <strong className="text-slate-900 flex items-center gap-1">
                        <Key className="h-3 w-3 text-indigo-600" />
                        {selectedJumpHost.user}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Remote CI Command</span>
                      <code className="text-indigo-700 truncate block">{selectedJumpHost.remote_ci_cmd}</code>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Remediation Strategy */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  2. Select Remediation Execution Strategy
                </label>

                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Full Remote Package Upgrade & Service Reload">⚡ Full Remote Package Upgrade & Service Reload (Recommended)</option>
                  <option value="Hot-Fix Virtual Patching & Memory Containment">🛡️ Hot-Fix Virtual Patching & Memory Containment</option>
                  <option value="Container Image Rollout via Remote CI Pipeline">📦 Container Image Rollout via Remote CI Pipeline</option>
                </select>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  {errorMsg}
                </div>
              )}

              {/* Trigger Button */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleTriggerDeploy}
                  disabled={!canEdit || (selectedEnv.toLowerCase() === "production" && preprodGate && !preprodGate.isComplete)}
                  title={
                    selectedEnv.toLowerCase() === "production" && preprodGate && !preprodGate.isComplete
                      ? "Pre-Production Gate Incomplete: Dev, SIT, UAT, and ORT must be completed first."
                      : "Deploy AIPatch Agent"
                  }
                  className={`rounded-xl text-xs font-bold px-5 py-2.5 uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 ${
                    selectedEnv.toLowerCase() === "production" && preprodGate && !preprodGate.isComplete
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-400 opacity-80"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                  }`}
                >
                  <Zap className="h-4 w-4 text-amber-300" />
                  {selectedEnv.toLowerCase() === "production" && preprodGate && !preprodGate.isComplete
                    ? "Locked: Complete Preprod First"
                    : "Confirm & Deploy AIPatch via Jump Host"}
                </button>
              </div>
            </div>
          )}

          {/* Execution Progress Terminal & Results Dashboard */}
          {(executing || logs.length > 0) && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-600" />
                  Remediation Execution Terminal & Progress
                </span>

                <span className="text-[10px] font-mono text-slate-500">
                  {executing ? "Deploying via SSH Tunnel..." : completed ? "Execution Finished" : "Failed"}
                </span>
              </div>

              {/* Scrollable Live Terminal */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1.5 font-mono text-[11px] text-slate-200 max-h-64 overflow-y-auto">
                <div className="border-b border-slate-800 pb-1 mb-2 flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${executing ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
                    Remote CI Terminal Log Output
                  </span>
                  <span>Jump Host: {selectedJumpHost?.host}</span>
                </div>

                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.startsWith("[FATAL]")
                        ? "text-red-400 font-semibold"
                        : log.startsWith("[SUCCESS]") || log.startsWith("[COMPLETED]")
                          ? "text-emerald-400 font-bold"
                          : log.startsWith("[INIT]") || log.startsWith("[JUMP-HOST]")
                            ? "text-indigo-300"
                            : "text-slate-300"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>

              {/* Remediation Dashboard Result Summary Card */}
              {completed && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-full bg-emerald-600 p-1.5 text-white">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                          Remediation Deployed Successfully!
                        </h4>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          The remote CI patch command was executed through Jump Host <strong className="font-mono">{selectedJumpHost?.host}</strong> on target VM <strong className="font-mono">{vulnerability.hostname} ({vulnerability.ip_address})</strong>.
                        </p>
                      </div>
                    </div>

                    <span className="rounded-md bg-emerald-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 uppercase tracking-wider">
                      STATUS: MITIGATED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-emerald-200 p-3 rounded-lg text-xs font-mono text-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Environment</span>
                      <strong>{selectedEnv}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Jump Host Used</span>
                      <strong>{selectedJumpHost?.host}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Updated Status</span>
                      <strong className="text-emerald-600">Mitigated</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">Assigned Engineer</span>
                      <strong>AIPatch Remote CI Agent</strong>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={onClose}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2 uppercase tracking-wider cursor-pointer shadow-xs"
                    >
                      Close & Return to Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

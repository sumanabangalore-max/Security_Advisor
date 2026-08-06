import React, { useState, useEffect } from "react";
import { 
  Cloud, Database, Server, Terminal, Send, CheckCircle2, AlertTriangle, 
  RefreshCw, Play, Shield, Filter, FileText, Check, ArrowUpRight, Cpu, Layers
} from "lucide-react";
import { api } from "../api";
import { LoggingConfig, ForwardedAuditLog, UserRole } from "../types";

interface ExternalLoggingPanelProps {
  userRole: UserRole;
}

export default function ExternalLoggingPanel({ userRole }: ExternalLoggingPanelProps) {
  const isAdmin = userRole === "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [testSeverity, setTestSeverity] = useState<"INFO" | "WARNING" | "ERROR" | "CRITICAL">("INFO");
  const [testMessage, setTestMessage] = useState("Enterprise Audit Log Verification Stream Test");

  const [logs, setLogs] = useState<ForwardedAuditLog[]>([]);
  const [logFilter, setLogFilter] = useState<string>("ALL");

  const [config, setConfig] = useState<LoggingConfig>({
    enabled: true,
    active_provider: "syslog",
    aws: {
      region: "us-east-1",
      log_group: "/aws/enterprise/secadvisor-audit",
      log_stream: "prod-cloudwatch-stream-01",
      access_key_id: "AKIAIOSFODNN7EXAMPLE",
      secret_access_key: "••••••••••••••••••••••••••••••••"
    },
    azure: {
      workspace_id: "72f988bf-86f1-41af-91ab-2d7cd011db47",
      shared_key: "••••••••••••••••••••••••••••••••",
      log_type: "SecAdvisor_Audit_CL"
    },
    syslog: {
      host: "syslog.corp.internal",
      port: 514,
      protocol: "udp",
      format: "cef",
      facility: "Security/Authorization (4)",
      min_severity: "info"
    },
    events_forwarded_count: 1428
  });

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.get<LoggingConfig>("/api/v1/admin/logging/config");
      setConfig(data);
    } catch (err: any) {
      setError("Failed to load external logging config.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await api.get<ForwardedAuditLog[]>("/api/v1/admin/logging/logs");
      setLogs(data);
    } catch {
      // ignore
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; config: LoggingConfig }>("/api/v1/admin/logging/config", config);
      setConfig(res.config);
      setSuccess(res.message || "External logging configuration saved.");
    } catch (err: any) {
      setError("Failed to save logging settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEvent = async () => {
    setTesting(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; log: ForwardedAuditLog }>("/api/v1/admin/logging/test", {
        provider: config.active_provider,
        severity: testSeverity,
        message: testMessage
      });
      setSuccess(res.message);
      if (res.log) {
        setLogs(prev => [res.log, ...prev]);
        setConfig(prev => ({
          ...prev,
          events_forwarded_count: (prev.events_forwarded_count || 0) + 1,
          last_event_sent_at: new Date().toISOString()
        }));
      }
    } catch (err: any) {
      setError("Log forwarding test failed: " + (err.message || "Unknown error"));
    } finally {
      setTesting(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (logFilter === "ALL") return true;
    return l.provider === logFilter.toLowerCase() || l.severity === logFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mr-3" />
        <span className="text-slate-600 font-medium">Loading SIEM Logging configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">External SIEM Logging & Forwarding</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                config.enabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {config.enabled ? `Active (${config.active_provider.toUpperCase()})` : "Disabled"}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Stream security audit events, vulnerability alerts, and remediation events to AWS CloudWatch, Azure Log Analytics Workspace, or Syslog / CEF / LEEF collector.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-500">Total Forwarded</div>
            <div className="text-lg font-bold text-slate-900 font-mono">{(config.events_forwarded_count || 0).toLocaleString()} Events</div>
          </div>
          <button
            type="button"
            onClick={handleSendTestEvent}
            disabled={testing}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 mr-1.5 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Transmitting..." : "Send Test Audit Event"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Logging Error: </span> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Success: </span> {success}
          </div>
        </div>
      )}

      {/* Provider Selector Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Select SIEM / Cloud Logging Destination</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.enabled} 
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} 
              disabled={!isAdmin}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            <span className="ml-2 text-xs font-semibold text-slate-700">Enable Audit Stream</span>
          </label>
        </div>

        {/* Destination Radio Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* AWS CloudWatch Card */}
          <div
            onClick={() => isAdmin && setConfig({ ...config, active_provider: "aws" })}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              config.active_provider === "aws"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Cloud className="w-5 h-5 text-amber-600" /> AWS CloudWatch
              </div>
              {config.active_provider === "aws" && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <p className="text-xs text-slate-500">
              Stream log streams directly to AWS CloudWatch Log Groups via AWS SDK.
            </p>
          </div>

          {/* Azure Log Analytics Card */}
          <div
            onClick={() => isAdmin && setConfig({ ...config, active_provider: "azure" })}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              config.active_provider === "azure"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Database className="w-5 h-5 text-blue-600" /> Azure Log Analytics
              </div>
              {config.active_provider === "azure" && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <p className="text-xs text-slate-500">
              Post JSON HTTP events to Azure Log Analytics Workspace via Data Collector API.
            </p>
          </div>

          {/* Syslog / CEF Card */}
          <div
            onClick={() => isAdmin && setConfig({ ...config, active_provider: "syslog" })}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              config.active_provider === "syslog"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Server className="w-5 h-5 text-emerald-600" /> Syslog / CEF / LEEF
              </div>
              {config.active_provider === "syslog" && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              )}
            </div>
            <p className="text-xs text-slate-500">
              Forward standard RFC 5424 Syslog, ArcSight CEF, or QRadar LEEF events over UDP/TCP/TLS.
            </p>
          </div>
        </div>

        {/* Configuration Details Form for Active Provider */}
        <form onSubmit={handleSaveConfig} className="mt-6 space-y-6 pt-6 border-t border-slate-200">
          {config.active_provider === "aws" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-600" /> AWS CloudWatch Logs Credentials & Target
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AWS Region <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={config.aws.region}
                    onChange={(e) => setConfig({ ...config, aws: { ...config.aws, region: e.target.value } })}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  >
                    <option value="us-east-1">US East (N. Virginia - us-east-1)</option>
                    <option value="us-west-2">US West (Oregon - us-west-2)</option>
                    <option value="eu-west-1">Europe (Ireland - eu-west-1)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore - ap-southeast-1)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CloudWatch Log Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.aws.log_group}
                    onChange={(e) => setConfig({ ...config, aws: { ...config.aws, log_group: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="/aws/enterprise/secadvisor-audit"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Log Stream Name
                  </label>
                  <input
                    type="text"
                    value={config.aws.log_stream}
                    onChange={(e) => setConfig({ ...config, aws: { ...config.aws, log_stream: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="prod-cloudwatch-stream-01"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AWS Access Key ID
                  </label>
                  <input
                    type="text"
                    value={config.aws.access_key_id}
                    onChange={(e) => setConfig({ ...config, aws: { ...config.aws, access_key_id: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {config.active_provider === "azure" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" /> Azure Log Analytics Workspace API Setup
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Workspace ID (GUID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.azure.workspace_id}
                    onChange={(e) => setConfig({ ...config, azure: { ...config.azure, workspace_id: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="72f988bf-86f1-41af-91ab-2d7cd011db47"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary / Shared Key
                  </label>
                  <input
                    type="password"
                    value={config.azure.shared_key}
                    onChange={(e) => setConfig({ ...config, azure: { ...config.azure, shared_key: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Log Type Name (Suffix _CL)
                  </label>
                  <input
                    type="text"
                    value={config.azure.log_type}
                    onChange={(e) => setConfig({ ...config, azure: { ...config.azure, log_type: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="SecAdvisor_Audit_CL"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {config.active_provider === "syslog" && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600" /> Syslog / SIEM Server Configuration
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Syslog Host / IP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.syslog.host}
                    onChange={(e) => setConfig({ ...config, syslog: { ...config.syslog, host: e.target.value } })}
                    disabled={!isAdmin}
                    placeholder="syslog.corp.internal or 10.0.1.200"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={config.syslog.port}
                    onChange={(e) => setConfig({ ...config, syslog: { ...config.syslog, port: parseInt(e.target.value) || 514 } })}
                    disabled={!isAdmin}
                    placeholder="514 or 6514"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transport Protocol
                  </label>
                  <select
                    value={config.syslog.protocol}
                    onChange={(e) => setConfig({ ...config, syslog: { ...config.syslog, protocol: e.target.value as any } })}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  >
                    <option value="udp">UDP (Port 514 - High Speed)</option>
                    <option value="tcp">TCP (Port 514 - Reliable Delivery)</option>
                    <option value="tls">TLS / Encrypted TCP (Port 6514)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Message Event Format
                  </label>
                  <select
                    value={config.syslog.format}
                    onChange={(e) => setConfig({ ...config, syslog: { ...config.syslog, format: e.target.value as any } })}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  >
                    <option value="cef">CEF - Common Event Format (ArcSight / Splunk)</option>
                    <option value="leef">LEEF - Log Event Extended Format (IBM QRadar)</option>
                    <option value="rfc5424">RFC 5424 Syslog Standard</option>
                    <option value="json">Structured JSON Payload</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
              >
                {saving ? "Saving Configuration..." : "Save External Logging Settings"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Test Generator & Live Forwarded Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" /> Live Audit Event Forwarding Stream
            </h3>
            <p className="text-xs text-slate-500">
              Real-time feed of events dispatched to external cloud SIEM instances.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 text-slate-800"
            >
              <option value="ALL">All Providers & Severities</option>
              <option value="aws">AWS CloudWatch Only</option>
              <option value="azure">Azure Log Analytics Only</option>
              <option value="syslog">Syslog / CEF Only</option>
              <option value="CRITICAL">Critical Severities Only</option>
            </select>
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log List Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Log ID & Time</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">User & Event</th>
                <th className="px-4 py-3">Message & Raw Payload</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans italic">
                    No forwarded logs recorded yet. Use "Send Test Audit Event" above to trigger a live test.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{log.id}</div>
                      <div className="text-[10px] text-slate-500 font-sans">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.provider === "aws" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        log.provider === "azure" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                        "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {log.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                        log.severity === "WARNING" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-sans">
                      <div className="font-semibold text-slate-900">{log.user}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{log.event_type}</div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="font-sans text-slate-900 font-medium truncate">{log.message}</div>
                      <div className="text-[10px] text-slate-500 truncate" title={log.raw_payload}>{log.raw_payload}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                        <Check className="w-3 h-3 mr-1" /> DELIVERED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

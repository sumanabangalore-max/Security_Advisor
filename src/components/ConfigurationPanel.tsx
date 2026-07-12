import React, { useState, useEffect } from "react";
import { 
  Settings, Mail, ShieldAlert, Key, UserCheck, 
  Send, History, CheckCircle, AlertTriangle, 
  RefreshCw, Play, Clock, ListCollapse 
} from "lucide-react";
import { api } from "../api";
import UserManagementPanel from "./UserManagementPanel";

interface ConfigurationPanelProps {
  userRole: "admin" | "analyst" | "viewer";
}

interface SmtpSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  sender_email: string;
  default_recipient: string;
  alert_thresholds: number[];
  enable_follow_up: boolean;
  follow_up_interval_days: number;
}

interface EmailLog {
  timestamp: string;
  software: string;
  version: string;
  owner: string;
  threshold: number;
  recipient: string;
  status: string;
  error?: string;
}

export default function ConfigurationPanel({ userRole }: ConfigurationPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"smtp" | "users">("smtp");
  const [settings, setSettings] = useState<SmtpSettings>({
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_pass: "",
    sender_email: "",
    default_recipient: "",
    alert_thresholds: [15, 30, 60, 90],
    enable_follow_up: true,
    follow_up_interval_days: 7
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [testEmail, setTestEmail] = useState("");
  const [testSuccess, setTestSuccess] = useState("");
  const [testError, setTestError] = useState("");

  const [checkReport, setCheckReport] = useState<any | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  const isConfigured = !!(settings.smtp_host && settings.smtp_port);
  const canEdit = userRole === "admin";

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.get<SmtpSettings>("/api/v1/smtp/settings");
      setSettings(data);
    } catch (err: any) {
      setError("Failed to fetch SMTP and notification settings.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await api.get<EmailLog[]>("/api/v1/smtp/logs");
      setEmailLogs(data);
    } catch {
      // Quietly ignore or set empty log list
      setEmailLogs([]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.patch("/api/v1/smtp/settings", settings);
      setSuccess("Alert notification policies and SMTP settings saved successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to persist SMTP policies.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testing) return;

    setTesting(true);
    setTestSuccess("");
    setTestError("");

    try {
      const res = await api.post<{ success: boolean; messageId: string }>("/api/v1/smtp/test", {
        test_email: testEmail.trim()
      });
      if (res.success) {
        setTestSuccess(`SMTP Test successful! Message ID: ${res.messageId}`);
        setTestEmail("");
        fetchLogs();
      }
    } catch (err: any) {
      setTestError(err.message || "SMTP handshake failed. Verify server name, credentials and port secure protocol.");
    } finally {
      setTesting(false);
    }
  };

  const handleManualCheck = async () => {
    if (triggeringCheck) return;

    setTriggeringCheck(true);
    setSuccess("");
    setError("");
    try {
      const report = await api.post<any>("/api/v1/smtp/trigger-check", {});
      setCheckReport(report);
      setSuccess(`Completed lifecycle expiry checks! Triggered ${report.triggered_alerts_count} alert email(s).`);
      fetchLogs();
    } catch (err: any) {
      setError("Failed to run on-demand expiry scan: " + err.message);
    } finally {
      setTriggeringCheck(false);
    }
  };

  const toggleThreshold = (day: number) => {
    if (!canEdit) return;
    const current = [...settings.alert_thresholds];
    if (current.includes(day)) {
      setSettings({
        ...settings,
        alert_thresholds: current.filter(d => d !== day)
      });
    } else {
      setSettings({
        ...settings,
        alert_thresholds: [...current, day].sort((a, b) => a - b)
      });
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-[#121214] border border-zinc-800 rounded-lg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
        <p className="text-xs text-zinc-500 font-mono animate-pulse">Retrieving SMTP & advisory profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="configuration-container">
      {/* Configuration Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-[#121214] p-5 border border-zinc-800 rounded-lg shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">System Settings & Configurations</h2>
          </div>
          <p className="text-xs text-zinc-500 font-medium">Control SMTP services, lifecycle alert rules, thresholds, and administrative access directory</p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-l border-zinc-850 pl-4">
          <button
            onClick={() => setActiveSubTab("smtp")}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded border transition-all cursor-pointer ${
              activeSubTab === "smtp"
                ? "bg-emerald-600/10 border-emerald-500 text-emerald-400 font-extrabold"
                : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-850"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            SMTP & Notifications
          </button>
          <button
            onClick={() => setActiveSubTab("users")}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded border transition-all cursor-pointer ${
              activeSubTab === "users"
                ? "bg-emerald-600/10 border-emerald-500 text-emerald-400 font-extrabold"
                : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-850"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Users & Access Control
          </button>
        </div>
      </div>

      {activeSubTab === "users" ? (
        <UserManagementPanel userRole={userRole} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="smtp-alert-layout">
          
          {/* Main SMTP & Rule Configuration (8 Columns) */}
          <div className="xl:col-span-8 space-y-6">
            <form onSubmit={handleSaveSettings} className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-6 shadow-md">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
                    <Mail className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">SMTP Server Properties</h3>
                    <p className="text-[11px] text-zinc-550">Configure outgoing mail relay server and sender identities</p>
                  </div>
                </div>
                {!isConfigured && (
                  <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    SMTP Simulated Mode (No Server)
                  </span>
                )}
              </div>

              {error && <div className="text-xs text-red-400 font-mono bg-red-500/5 p-3 rounded border border-red-500/15">{error}</div>}
              {success && <div className="text-xs text-emerald-400 font-mono bg-emerald-500/5 p-3 rounded border border-emerald-500/15">{success}</div>}

              {/* Server Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">SMTP Relay Server / Host</label>
                  <input
                    type="text"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    placeholder="e.g. smtp.gmail.com, mail.corporate-relay.com"
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Server Port</label>
                  <input
                    type="number"
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({ ...settings, smtp_port: Number(e.target.value) })}
                    placeholder="e.g. 587, 465, 25"
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Key className="h-3 w-3 text-zinc-550" />
                    Authentication Username
                  </label>
                  <input
                    type="text"
                    value={settings.smtp_user}
                    onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                    placeholder="SMTP Username or Email..."
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Key className="h-3 w-3 text-zinc-550" />
                    Authentication Password
                  </label>
                  <input
                    type="password"
                    value={settings.smtp_pass}
                    onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                    placeholder="SMTP Account Password..."
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>

                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sender "From" Email address</label>
                  <input
                    type="email"
                    value={settings.sender_email}
                    onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                    placeholder="e.g. secadvisor@company.com"
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                <div className="md:col-span-6 space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Default/Backup Alert Recipient</label>
                  <input
                    type="email"
                    value={settings.default_recipient}
                    onChange={(e) => setSettings({ ...settings, default_recipient: e.target.value })}
                    placeholder="e.g. suman.ailearn@gmail.com"
                    disabled={!canEdit}
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Alert Thresholds & Rules Section */}
              <div className="border-t border-zinc-800/80 pt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 text-emerald-400" />
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Pre-Expiry Milestones & Notifications</h4>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Configure the timeline thresholds before a software asset reaches its official vendor End-Of-Support (EOS) or End-Of-Life (EOL) date to trigger alert emails automatically.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Milestones column */}
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block mb-1">Pre-Expiry Milestones</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[15, 30, 60, 90].map((day) => {
                        const isChecked = settings.alert_thresholds.includes(day);
                        return (
                          <div 
                            key={day} 
                            onClick={() => toggleThreshold(day)}
                            className={`flex items-center justify-between rounded border p-2.5 cursor-pointer transition-all ${
                              isChecked 
                                ? "bg-emerald-600/5 border-emerald-500/40 text-white font-semibold" 
                                : "bg-[#161619] border-zinc-800 text-zinc-400 hover:border-zinc-700"
                            }`}
                          >
                            <span className="text-xs">{day} Days Before</span>
                            <div className={`h-4 w-4 rounded-sm border flex items-center justify-center transition-colors ${
                              isChecked ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-700 bg-zinc-950"
                            }`}>
                              {isChecked && <CheckCircle className="h-3 w-3 text-[#121214]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Follow up controls column */}
                  <div className="md:col-span-6 space-y-4">
                    <label className="text-[10px] font-bold text-zinc-450 uppercase tracking-wider block mb-1">Expired Asset Follow-Up Rules</label>
                    
                    <div className="rounded border border-zinc-800 bg-[#161619] p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-zinc-200">Enable Recurring Follow-Ups</span>
                          <p className="text-[10px] text-zinc-550 leading-normal">Keep reminding owners after dates pass</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => canEdit && setSettings({ ...settings, enable_follow_up: !settings.enable_follow_up })}
                          disabled={!canEdit}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            settings.enable_follow_up ? "bg-emerald-600" : "bg-zinc-800"
                          } disabled:cursor-not-allowed`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              settings.enable_follow_up ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {settings.enable_follow_up && (
                        <div className="space-y-1.5 border-t border-zinc-800/80 pt-2.5 animate-in fade-in duration-200">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="h-3 w-3 text-zinc-550" />
                            Reminder Interval (Days)
                          </label>
                          <select
                            value={settings.follow_up_interval_days}
                            onChange={(e) => setSettings({ ...settings, follow_up_interval_days: Number(e.target.value) })}
                            disabled={!canEdit}
                            className="w-full bg-[#121214] border border-zinc-850 rounded p-1.5 text-xs text-white focus:outline-none focus:border-zinc-700 cursor-pointer"
                          >
                            <option value={3}>Every 3 Days</option>
                            <option value={7}>Weekly (Every 7 Days)</option>
                            <option value={14}>Bi-Weekly (Every 14 Days)</option>
                            <option value={30}>Monthly (Every 30 Days)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              {canEdit ? (
                <div className="border-t border-zinc-800/80 pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-md shadow-emerald-950/20 cursor-pointer transition-colors"
                  >
                    {saving ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                    ) : (
                      <Settings className="h-4 w-4" />
                    )}
                    <span>SAVE SYSTEM NOTIFICATION POLICIES</span>
                  </button>
                </div>
              ) : (
                <div className="border-t border-zinc-800/80 pt-4 text-center">
                  <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest bg-zinc-950 px-3 py-2.5 rounded">
                    Settings values are locked (Read-Only)
                  </span>
                </div>
              )}
            </form>

            {/* Recent Email Notifications log */}
            <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-zinc-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Notification Delivery Logs</h4>
                </div>
                <button
                  onClick={fetchLogs}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
                  title="Refresh Notification Log"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {emailLogs.length === 0 ? (
                <p className="text-[11px] text-zinc-550 italic text-center py-6">No outbound notifications registered yet. Trigger a manual expiry check or configure milestones to begin tracking.</p>
              ) : (
                <div className="overflow-hidden rounded border border-zinc-850">
                  <table className="w-full text-left border-collapse" id="logs-table">
                    <thead>
                      <tr className="bg-zinc-950/40 text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest border-b border-zinc-850">
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Asset / Software</th>
                        <th className="px-3 py-2">Owner / Recipient</th>
                        <th className="px-3 py-2">Trigger Threshold</th>
                        <th className="px-3 py-2 text-right">Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/50 text-xs text-zinc-300 font-mono">
                      {emailLogs.map((log, idx) => {
                        const isSuccess = log.status.includes("Successfully") || log.status.includes("Simulated");
                        return (
                          <tr key={idx} className="hover:bg-zinc-900/10 transition-colors">
                            <td className="px-3 py-2.5 text-zinc-500 text-[10px] whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-white">{log.software}</span>
                              <span className="text-zinc-500 ml-1 text-[10px]">v{log.version}</span>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-400 text-[11px]">
                              <div>{log.owner}</div>
                              <div className="text-[9px] text-zinc-550">{log.recipient}</div>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-400">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3 text-zinc-650" />
                                {log.threshold <= 0 ? "Expired followup" : `${log.threshold} Days`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                isSuccess ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`} title={log.error || undefined}>
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Test & Trigger Diagnostics (4 Columns) */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Run manual audit */}
            <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4 shadow-md">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2.5">
                <Play className="h-4 w-4 text-emerald-400" />
                Advisory Expiry Engine
              </h4>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Manually scan the inventory assets against configured vendor support periods and immediately deliver simulated or actual emails based on ownership boundaries.
              </p>

              <button
                type="button"
                onClick={handleManualCheck}
                disabled={triggeringCheck}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white py-2.5 px-4 uppercase tracking-wider transition-colors cursor-pointer"
              >
                {triggeringCheck ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>Check Expiries & Trigger Alerts</span>
              </button>

              {checkReport && (
                <div className="rounded border border-zinc-850 bg-zinc-950/40 p-3 space-y-2 text-[10px] font-mono animate-in slide-in-from-top-1">
                  <div className="text-zinc-400 font-bold border-b border-zinc-850 pb-1">LAST SCAN OUTPUT</div>
                  <div className="flex justify-between">
                    <span className="text-zinc-550">Alerts Sent/Simulated:</span>
                    <span className="text-emerald-400 font-bold">{checkReport.triggered_alerts_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-550">Milestones Analyzed:</span>
                    <span className="text-white">{checkReport.alerts_checked}</span>
                  </div>
                  {checkReport.detailed_reports && checkReport.detailed_reports.length > 0 && (
                    <div className="pt-2 border-t border-zinc-850">
                      <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Triggered Events:</div>
                      <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-zinc-900 pr-1">
                        {checkReport.detailed_reports.map((rep: any, idx: number) => (
                          <div key={idx} className="text-[9px] pt-1 text-zinc-450 leading-relaxed">
                            • <strong className="text-zinc-300">{rep.software_name}</strong> ({rep.milestoneType}) alert logged to owner <span className="text-emerald-400">{rep.owner}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Test Connection Form */}
            <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4 shadow-md">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-800 pb-2.5">
                <Send className="h-4 w-4 text-emerald-400" />
                Test Mail Gateway
              </h4>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Test your connection parameters immediately by firing a test email from the server.
              </p>

              {testError && <p className="text-[10px] text-red-400 font-mono bg-red-500/5 p-2 rounded border border-red-500/15">{testError}</p>}
              {testSuccess && <p className="text-[10px] text-emerald-400 font-mono bg-emerald-500/5 p-2 rounded border border-emerald-500/15">{testSuccess}</p>}

              <form onSubmit={handleTestSmtp} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Test Destination Email</label>
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter recipient email..."
                    className="w-full rounded border border-zinc-800 bg-[#161619] px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testing || !isConfigured}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-[10px] font-bold text-zinc-300 hover:text-white py-2 px-3 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {testing ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Send Test Email</span>
                </button>
                
                {!isConfigured && (
                  <p className="text-[9px] text-zinc-600 leading-normal text-center italic">
                    Configure SMTP host & port above to enable live mail transmission.
                  </p>
                )}
              </form>
            </div>

            {/* Quick configuration instructions */}
            <div className="rounded-lg border border-zinc-850 bg-zinc-950/20 p-4 space-y-2.5">
              <h5 className="text-[9px] font-bold text-zinc-450 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                INTEGRATION TIP
              </h5>
              <p className="text-[10px] text-zinc-500 leading-normal">
                SEC_ADVISOR integrates with standard SMTP relays (Gmail App Passwords, Mailgun, Amazon SES, SendGrid). If no SMTP parameters are provided, the system falls back to a highly descriptive <strong>Simulated Logging mode</strong>, so your lifecycle events are always tracked and auditable directly via the Notification Logs table below.
              </p>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

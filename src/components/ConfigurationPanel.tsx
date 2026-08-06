import React, { useState, useEffect } from "react";
import { 
  Mail, ShieldAlert, Key, 
  Send, History, CheckCircle, AlertTriangle, 
  RefreshCw, Play, Clock 
} from "lucide-react";
import { api } from "../api";

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
      <div className="p-16 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
        <p className="text-xs text-slate-500 font-mono animate-pulse">Retrieving SMTP & advisory profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="configuration-container">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">SMTP Server & Alert Notification Configuration</h2>
              <p className="text-xs text-slate-500">Configure outgoing mail relay server, automated lifecycle expiry thresholds, and email dispatch logs</p>
            </div>
          </div>
        </div>

        {!isConfigured && (
          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            Simulated Mail Mode
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="smtp-alert-layout">
        
        {/* Main SMTP & Rule Configuration (8 Columns) */}
        <div className="xl:col-span-8 space-y-6">
          <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-1.5 text-indigo-600 border border-indigo-100">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">SMTP Server Relay Properties</h3>
                  <p className="text-[11px] text-slate-500">Configure outgoing mail relay server credentials and sender identities</p>
                </div>
              </div>
            </div>

            {error && <div className="text-xs text-red-700 font-mono bg-red-50 p-3 rounded-xl border border-red-200">{error}</div>}
            {success && <div className="text-xs text-emerald-700 font-mono bg-emerald-50 p-3 rounded-xl border border-emerald-200">{success}</div>}

            {/* Server Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">SMTP Relay Server / Host</label>
                <input
                  type="text"
                  value={settings.smtp_host}
                  onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                  placeholder="e.g. smtp.gmail.com, mail.corporate-relay.com"
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">Server Port</label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings({ ...settings, smtp_port: Number(e.target.value) })}
                  placeholder="e.g. 587, 465, 25"
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Key className="h-3 w-3 text-slate-400" />
                  Authentication Username
                </label>
                <input
                  type="text"
                  value={settings.smtp_user}
                  onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  placeholder="SMTP Username or Email..."
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Key className="h-3 w-3 text-slate-400" />
                  Authentication Password
                </label>
                <input
                  type="password"
                  value={settings.smtp_pass}
                  onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                  placeholder="SMTP Account Password..."
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">Sender "From" Email Address</label>
                <input
                  type="email"
                  value={settings.sender_email}
                  onChange={(e) => setSettings({ ...settings, sender_email: e.target.value })}
                  placeholder="e.g. secadvisor@company.com"
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">Default/Backup Alert Recipient</label>
                <input
                  type="email"
                  value={settings.default_recipient}
                  onChange={(e) => setSettings({ ...settings, default_recipient: e.target.value })}
                  placeholder="e.g. suman.ailearn@gmail.com"
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Alert Thresholds & Rules Section */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-indigo-600" />
                <h4 className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">Pre-Expiry Milestones & Notifications</h4>
              </div>

              <p className="text-[11px] text-slate-500">
                Configure timeline thresholds before a software asset reaches its official vendor End-Of-Support (EOS) or End-Of-Life (EOL) date to trigger alert emails automatically.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Milestones column */}
                <div className="md:col-span-6 space-y-2">
                  <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Pre-Expiry Milestones</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[15, 30, 60, 90].map((day) => {
                      const isChecked = settings.alert_thresholds.includes(day);
                      return (
                        <div 
                          key={day} 
                          onClick={() => toggleThreshold(day)}
                          className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition-all ${
                            isChecked 
                              ? "bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold shadow-xs" 
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-xs">{day} Days Before</span>
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition-colors ${
                            isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                          }`}>
                            {isChecked && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Follow up controls column */}
                <div className="md:col-span-6 space-y-4">
                  <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Expired Asset Follow-Up Rules</label>
                  
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-900">Enable Recurring Follow-Ups</span>
                        <p className="text-[10px] text-slate-500 leading-normal">Keep reminding owners after dates pass</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => canEdit && setSettings({ ...settings, enable_follow_up: !settings.enable_follow_up })}
                        disabled={!canEdit}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          settings.enable_follow_up ? "bg-indigo-600" : "bg-slate-300"
                        } disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            settings.enable_follow_up ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {settings.enable_follow_up && (
                      <div className="space-y-1.5 border-t border-slate-200/80 pt-2.5 animate-in fade-in duration-200">
                        <label className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          Reminder Interval (Days)
                        </label>
                        <select
                          value={settings.follow_up_interval_days}
                          onChange={(e) => setSettings({ ...settings, follow_up_interval_days: Number(e.target.value) })}
                          disabled={!canEdit}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  {saving ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span>SAVE SMTP & NOTIFICATION POLICIES</span>
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest bg-slate-100 px-3 py-2 rounded-lg">
                  Settings values are locked (Read-Only)
                </span>
              </div>
            )}
          </form>

          {/* Recent Email Notifications log */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Notification Delivery Logs</h4>
              </div>
              <button
                onClick={fetchLogs}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                title="Refresh Notification Log"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {emailLogs.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic text-center py-6">No outbound notifications registered yet. Trigger a manual expiry check or configure milestones to begin tracking.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse" id="logs-table">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest border-b border-slate-200">
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">Asset / Software</th>
                      <th className="px-3 py-2">Owner / Recipient</th>
                      <th className="px-3 py-2">Trigger Threshold</th>
                      <th className="px-3 py-2 text-right">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-mono">
                    {emailLogs.map((log, idx) => {
                      const isSuccess = log.status.includes("Successfully") || log.status.includes("Simulated");
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-3 py-2.5 text-slate-500 text-[10px] whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-semibold text-slate-900">{log.software}</span>
                            <span className="text-slate-500 ml-1 text-[10px]">v{log.version}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 text-[11px]">
                            <div>{log.owner}</div>
                            <div className="text-[9px] text-slate-400">{log.recipient}</div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {log.threshold <= 0 ? "Expired followup" : `${log.threshold} Days`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase border ${
                              isSuccess ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Play className="h-4 w-4 text-indigo-600" />
              Advisory Expiry Engine
            </h4>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Manually scan the inventory assets against configured vendor support periods and immediately deliver simulated or actual emails based on ownership boundaries.
            </p>

            <button
              type="button"
              onClick={handleManualCheck}
              disabled={triggeringCheck}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white py-2.5 px-4 uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${triggeringCheck ? "animate-spin" : ""}`} />
              <span>Check Expiries & Trigger Alerts</span>
            </button>

            {checkReport && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-[10px] font-mono animate-in slide-in-from-top-1">
                <div className="text-slate-800 font-bold border-b border-slate-200 pb-1">LAST SCAN OUTPUT</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Alerts Sent/Simulated:</span>
                  <span className="text-emerald-700 font-bold">{checkReport.triggered_alerts_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Milestones Analyzed:</span>
                  <span className="text-slate-900">{checkReport.alerts_checked}</span>
                </div>
                {checkReport.detailed_reports && checkReport.detailed_reports.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Triggered Events:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-slate-200 pr-1">
                      {checkReport.detailed_reports.map((rep: any, idx: number) => (
                        <div key={idx} className="text-[9px] pt-1 text-slate-700 leading-relaxed">
                          • <strong className="text-slate-900">{rep.software_name}</strong> ({rep.milestoneType}) alert logged to owner <span className="text-indigo-600">{rep.owner}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Connection Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <h4 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Send className="h-4 w-4 text-indigo-600" />
              Test Mail Gateway
            </h4>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Test your connection parameters immediately by firing a test email from the server.
            </p>

            {testError && <p className="text-[10px] text-red-700 font-mono bg-red-50 p-2 rounded-xl border border-red-200">{testError}</p>}
            {testSuccess && <p className="text-[10px] text-emerald-700 font-mono bg-emerald-50 p-2 rounded-xl border border-emerald-200">{testSuccess}</p>}

            <form onSubmit={handleTestSmtp} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">Test Destination Email</label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={testing || !isConfigured}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-xs font-bold text-white py-2 px-3 uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
                <span>Send Test Email</span>
              </button>
              
              {!isConfigured && (
                <p className="text-[10px] text-slate-500 leading-normal text-center italic">
                  Configure SMTP host & port above to enable live mail transmission.
                </p>
              )}
            </form>
          </div>

          {/* Quick configuration instructions */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <h5 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              INTEGRATION TIP
            </h5>
            <p className="text-[11px] text-slate-600 leading-normal">
              SecAdvisor integrates with standard SMTP relays (Gmail App Passwords, Mailgun, Amazon SES, SendGrid). If no SMTP parameters are provided, the system falls back to a highly descriptive <strong>Simulated Logging mode</strong>, so your lifecycle events are always tracked and auditable directly via the Notification Logs table.
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}

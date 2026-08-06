import React, { useState, useEffect } from "react";
import { 
  Building2, Server, Shield, Key, CheckCircle2, AlertTriangle, 
  RefreshCw, Play, Search, Users, ShieldCheck, Lock, Terminal, Radio, ArrowRight, UserCheck
} from "lucide-react";
import { api } from "../api";
import { LdapConfig, UserRole } from "../types";

interface LdapConfigPanelProps {
  userRole: UserRole;
}

export default function LdapConfigPanel({ userRole }: LdapConfigPanelProps) {
  const isAdmin = userRole === "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testAuthLoading, setTestAuthLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // Test User Auth State
  const [testUsername, setTestUsername] = useState("jdoe@corp.internal");
  const [testPassword, setTestPassword] = useState("Password123!");
  const [testAuthResult, setTestAuthResult] = useState<any | null>(null);

  const [config, setConfig] = useState<LdapConfig>({
    enabled: true,
    server_host: "ad.corp.internal",
    port: 389,
    security_protocol: "starttls",
    base_dn: "DC=corp,DC=internal",
    bind_dn: "CN=sec_service,OU=ServiceAccounts,DC=corp,DC=internal",
    bind_password: "",
    user_filter: "(&(objectClass=user)(sAMAccountName={0}))",
    group_filter: "(&(objectClass=group)(member={0}))",
    attr_username: "sAMAccountName",
    attr_email: "mail",
    attr_name: "displayName",
    attr_group: "memberOf",
    group_role_mapping: {
      admin_group: "CN=SecOps-Admins,OU=Groups,DC=corp,DC=internal",
      analyst_group: "CN=SecOps-Analysts,OU=Groups,DC=corp,DC=internal",
      viewer_group: "CN=SecOps-DomainUsers,OU=Groups,DC=corp,DC=internal"
    },
    status: "connected"
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await api.get<LdapConfig>("/api/v1/admin/ldap/config");
      setConfig(data);
      setError("");
    } catch (err: any) {
      setError("Failed to fetch LDAP configuration from server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; config: LdapConfig }>("/api/v1/admin/ldap/config", config);
      setConfig(res.config);
      setSuccess(res.message || "Active Directory configuration saved successfully.");
    } catch (err: any) {
      setError("Failed to save LDAP settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setSuccess("");
    setTestLogs([]);

    try {
      const res = await api.post<{ success: boolean; message: string; logs: string[]; user_count: number }>("/api/v1/admin/ldap/test", config);
      setTestLogs(res.logs || []);
      setSuccess(res.message);
      setConfig(prev => ({ ...prev, status: "connected" }));
    } catch (err: any) {
      setError("LDAP Connection & Bind Test Failed: " + (err.message || "Unknown error"));
      setConfig(prev => ({ ...prev, status: "error" }));
    } finally {
      setTesting(false);
    }
  };

  const handleSyncUsers = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; synced_at: string }>("/api/v1/admin/ldap/sync");
      setSuccess(res.message);
      setConfig(prev => ({ ...prev, last_synced_at: res.synced_at }));
    } catch (err: any) {
      setError("LDAP AD Sync failed: " + (err.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  const handleTestUserAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestAuthLoading(true);
    setTestAuthResult(null);

    try {
      const res = await api.post<any>("/api/v1/admin/ldap/test-auth", {
        username: testUsername,
        password: testPassword
      });
      setTestAuthResult({ success: true, ...res });
    } catch (err: any) {
      setTestAuthResult({ success: false, detail: err.message || "Authentication failed" });
    } finally {
      setTestAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-xs">
        <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mr-3" />
        <span className="text-slate-600 font-medium">Loading Active Directory LDAP configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Active Directory / LDAP Integration</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                config.enabled && config.status === "connected"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : config.enabled
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                <Radio className="w-3 h-3 mr-1 animate-pulse" />
                {config.enabled ? (config.status === "connected" ? "AD Connected & Synced" : "Pending Test") : "Disabled"}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Configure seamless Single Sign-On (SSO) and role synchronization with your local Windows Active Directory domain controller or OpenLDAP server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleSyncUsers}
            disabled={syncing || !config.enabled}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
            {syncing ? "Syncing Users..." : "Sync AD Users Now"}
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 mr-1.5 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testing Bind..." : "Test LDAP Bind"}
          </button>
        </div>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">LDAP Error: </span> {error}
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

      {/* Main Form & Diagnostic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <form onSubmit={handleSaveConfig} className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Domain Controller Server Settings</h3>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config.enabled} 
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} 
                  disabled={!isAdmin}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2 text-xs font-semibold text-slate-700">Enable LDAP</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Server Host / IP Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.server_host}
                  onChange={(e) => setConfig({ ...config, server_host: e.target.value })}
                  disabled={!isAdmin}
                  placeholder="e.g. ad.corp.internal or 10.0.1.50"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  LDAP Port <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 389 })}
                  disabled={!isAdmin}
                  placeholder="389 or 636"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Protocol
                </label>
                <select
                  value={config.security_protocol}
                  onChange={(e) => setConfig({ ...config, security_protocol: e.target.value as any })}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900"
                >
                  <option value="none">None (Plain LDAP Port 389)</option>
                  <option value="starttls">STARTTLS (Port 389)</option>
                  <option value="ldaps">LDAPS (SSL/TLS Port 636)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Base DN (Domain Component) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.base_dn}
                  onChange={(e) => setConfig({ ...config, base_dn: e.target.value })}
                  disabled={!isAdmin}
                  placeholder="e.g. DC=corp,DC=internal"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  required
                />
              </div>
            </div>

            {/* Service Account Bind Credentials */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" /> Service Account Bind Credentials
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bind DN (Service Account)
                  </label>
                  <input
                    type="text"
                    value={config.bind_dn}
                    onChange={(e) => setConfig({ ...config, bind_dn: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="CN=sec_service,OU=ServiceAccounts,DC=corp,DC=internal"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bind Password
                  </label>
                  <input
                    type="password"
                    value={config.bind_password || ""}
                    onChange={(e) => setConfig({ ...config, bind_password: e.target.value })}
                    disabled={!isAdmin}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Search Filters & Attribute Mappings */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-indigo-600" /> User & Group LDAP Search Filters
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    User Object Filter
                  </label>
                  <input
                    type="text"
                    value={config.user_filter}
                    onChange={(e) => setConfig({ ...config, user_filter: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Group Object Filter
                  </label>
                  <input
                    type="text"
                    value={config.group_filter}
                    onChange={(e) => setConfig({ ...config, group_filter: e.target.value })}
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* AD Group to Role Mapping */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> AD Group to Enterprise Role Mapping
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Admin Role AD Group DN (Full Privileges)
                  </label>
                  <input
                    type="text"
                    value={config.group_role_mapping.admin_group}
                    onChange={(e) => setConfig({
                      ...config,
                      group_role_mapping: { ...config.group_role_mapping, admin_group: e.target.value }
                    })}
                    disabled={!isAdmin}
                    placeholder="CN=SecOps-Admins,OU=Groups,DC=corp,DC=internal"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Security Analyst AD Group DN (Remediation & Scan Access)
                  </label>
                  <input
                    type="text"
                    value={config.group_role_mapping.analyst_group}
                    onChange={(e) => setConfig({
                      ...config,
                      group_role_mapping: { ...config.group_role_mapping, analyst_group: e.target.value }
                    })}
                    disabled={!isAdmin}
                    placeholder="CN=SecOps-Analysts,OU=Groups,DC=corp,DC=internal"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Viewer / Default Domain Users Group DN (Read-Only)
                  </label>
                  <input
                    type="text"
                    value={config.group_role_mapping.viewer_group}
                    onChange={(e) => setConfig({
                      ...config,
                      group_role_mapping: { ...config.group_role_mapping, viewer_group: e.target.value }
                    })}
                    disabled={!isAdmin}
                    placeholder="CN=SecOps-DomainUsers,OU=Groups,DC=corp,DC=internal"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 disabled:opacity-60 text-slate-900 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-xs font-bold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving Configuration..." : "Save LDAP Configuration"}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Diagnostic & Test User Auth */}
        <div className="space-y-6">
          {/* Test AD User Authenticate Simulator */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" /> Test AD User Authentication
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Simulate an authenticating user login against your Active Directory domain.
            </p>

            <form onSubmit={handleTestUserAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  sAMAccountName / User Principal
                </label>
                <input
                  type="text"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  placeholder="jdoe@corp.internal"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AD Password
                </label>
                <input
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={testAuthLoading}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors flex items-center justify-center gap-1.5"
              >
                {testAuthLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Validate AD User Credentials
              </button>
            </form>

            {testAuthResult && (
              <div className={`mt-4 p-3 rounded-lg border text-xs font-mono ${
                testAuthResult.success 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {testAuthResult.success ? (
                  <div className="space-y-1.5">
                    <div className="font-bold text-emerald-900 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> AD Auth Successful
                    </div>
                    <div>User: {testAuthResult.matched_user?.displayName}</div>
                    <div>Email: {testAuthResult.matched_user?.mail}</div>
                    <div>Assigned Role: <span className="font-bold uppercase text-indigo-700">{testAuthResult.matched_user?.assigned_role}</span></div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-red-900">Auth Failed</div>
                    <div>{testAuthResult.detail}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Connection Log Console */}
          <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-4 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> Live Connection Diagnostics
              </span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                {config.status === "connected" ? "PORT 389 READY" : "IDLE"}
              </span>
            </div>

            <div className="h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px] leading-relaxed">
              {testLogs.length === 0 ? (
                <div className="text-slate-500 italic pt-6 text-center">
                  Click "Test LDAP Bind" to run live TCP socket DNS & SSL handshake verification.
                </div>
              ) : (
                testLogs.map((log, idx) => (
                  <div key={idx} className={log.includes("PASSED") || log.includes("SUCCESSFUL") ? "text-emerald-400 font-semibold" : "text-slate-300"}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

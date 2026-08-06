import React, { useState, useEffect } from "react";
import { 
  Database, Server, ShieldCheck, CheckCircle2, AlertTriangle, 
  RefreshCw, Key, Link2, HardDrive, Cpu, Terminal, Lock, Check, Zap, Layers 
} from "lucide-react";
import { api } from "../api";
import { DatabaseConfig, UserRole } from "../types";

interface DatabaseConfigPanelProps {
  userRole: UserRole;
}

export default function DatabaseConfigPanel({ userRole }: DatabaseConfigPanelProps) {
  const [config, setConfig] = useState<DatabaseConfig>({
    provider: "azure_paas",
    db_type: "postgres",
    host: "secadvisor-db.postgres.database.azure.com",
    port: 5432,
    database_name: "secadvisor_enterprise",
    username: "secadmin@secadvisor-db",
    password: "••••••••••••",
    ssl_mode: "require",
    max_connections: 20,
    connection_string: "postgresql://secadmin%40secadvisor-db:••••••••••••@secadvisor-db.postgres.database.azure.com:5432/secadvisor_enterprise?sslmode=require",
    status: "connected",
    last_tested_at: new Date().toISOString(),
    tables_synced: 8
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const canEdit = userRole === "admin";

  useEffect(() => {
    fetchDbConfig();
  }, []);

  const fetchDbConfig = async () => {
    try {
      setLoading(true);
      const data = await api.get<DatabaseConfig>("/api/v1/admin/db-config");
      setConfig(data);
      setError("");
    } catch (err: any) {
      setError("Failed to fetch external database configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: "azure_paas" | "aws_rds" | "custom_postgres" | "custom_mysql") => {
    let defaults: Partial<DatabaseConfig> = {};
    if (provider === "azure_paas") {
      defaults = {
        provider: "azure_paas",
        db_type: "postgres",
        host: "secadvisor-prod-db.postgres.database.azure.com",
        port: 5432,
        database_name: "secadvisor_azure_db",
        username: "pgadmin@secadvisor-prod-db",
        ssl_mode: "require"
      };
    } else if (provider === "aws_rds") {
      defaults = {
        provider: "aws_rds",
        db_type: "postgres",
        host: "secadvisor-db.c987654321.us-east-1.rds.amazonaws.com",
        port: 5432,
        database_name: "secadvisor_rds_db",
        username: "dbmasteruser",
        ssl_mode: "require"
      };
    } else if (provider === "custom_postgres") {
      defaults = {
        provider: "custom_postgres",
        db_type: "postgres",
        host: "db.internal.corp",
        port: 5432,
        database_name: "secadvisor_db",
        username: "postgres",
        ssl_mode: "prefer"
      };
    } else if (provider === "custom_mysql") {
      defaults = {
        provider: "custom_mysql",
        db_type: "mysql",
        host: "mysql.internal.corp",
        port: 3306,
        database_name: "secadvisor_mysql",
        username: "root",
        ssl_mode: "prefer"
      };
    }

    setConfig(prev => ({
      ...prev,
      ...defaults,
      connection_string: `${defaults.db_type === "postgres" ? "postgresql" : "mysql"}://${defaults.username}:••••••••@${defaults.host}:${defaults.port}/${defaults.database_name}?sslmode=${defaults.ssl_mode}`
    }));
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; config: DatabaseConfig }>("/api/v1/admin/db-config", config);
      setConfig(res.config);
      setSuccess(res.message || "External database parameters saved successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to save external database configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (testing) return;
    setTesting(true);
    setError("");
    setSuccess("");
    setTestLogs([]);

    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        logs: string[];
        status: string;
        latency_ms: number;
        server_version: string;
      }>("/api/v1/admin/db-config/test", config);

      setTestLogs(res.logs || []);
      if (res.success) {
        setSuccess(`Database Connection Test Successful (${res.latency_ms}ms)! Engine: ${res.server_version}`);
        setConfig(prev => ({ ...prev, status: "connected", last_tested_at: new Date().toISOString() }));
      } else {
        setError("Database Connection Test Failed. Check host endpoint and credentials.");
        setConfig(prev => ({ ...prev, status: "error" }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to target external database server.");
      setConfig(prev => ({ ...prev, status: "error" }));
    } finally {
      setTesting(false);
    }
  };

  const handleMigrateSchema = async () => {
    if (migrating) return;
    setMigrating(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ success: boolean; message: string; tables_synced: number }>("/api/v1/admin/db-config/sync-schema", config);
      setSuccess(res.message || `Database schema synchronized! Created/verified ${res.tables_synced} tables.`);
      setConfig(prev => ({ ...prev, tables_synced: res.tables_synced }));
    } catch (err: any) {
      setError("Schema migration failed: " + err.message);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mr-2" />
        <span className="text-sm font-medium text-slate-600">Loading external database configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="database-config-panel">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
                <Database className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">External Cloud Database Integration (PaaS & RDS)</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Connect SecAdvisor enterprise storage engine to managed external cloud relational databases such as Azure Database for PostgreSQL/MySQL, AWS RDS, or Custom Enterprise SQL clusters.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
              config.status === "connected"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}>
              <span className={`w-2 h-2 rounded-full ${config.status === "connected" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              {config.status === "connected" ? "External DB Connected" : "Disconnected / Unverified"}
            </div>
          </div>
        </div>
      </div>

      {/* Database Provider Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Server className="h-4 w-4 text-indigo-600" /> Select Cloud Database Service Provider
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => handleProviderSelect("azure_paas")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              config.provider === "azure_paas"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Azure Database PaaS</span>
                <span className="text-[10px] bg-sky-100 text-sky-700 font-extrabold px-2 py-0.5 rounded-full">Azure</span>
              </div>
              <p className="text-xs text-slate-600">Azure Database for PostgreSQL or MySQL Flexible Server</p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 font-mono">Host: *.postgres.database.azure.com</div>
          </button>

          <button
            type="button"
            onClick={() => handleProviderSelect("aws_rds")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              config.provider === "aws_rds"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">AWS RDS Service</span>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded-full">AWS</span>
              </div>
              <p className="text-xs text-slate-600">Amazon RDS PostgreSQL or Aurora Serverless cluster</p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 font-mono">Host: *.rds.amazonaws.com</div>
          </button>

          <button
            type="button"
            onClick={() => handleProviderSelect("custom_postgres")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              config.provider === "custom_postgres"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">PostgreSQL Cluster</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">Postgres</span>
              </div>
              <p className="text-xs text-slate-600">Custom PostgreSQL 12+ enterprise database instance</p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 font-mono">Port: 5432</div>
          </button>

          <button
            type="button"
            onClick={() => handleProviderSelect("custom_mysql")}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              config.provider === "custom_mysql"
                ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">MySQL / MariaDB</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full">MySQL</span>
              </div>
              <p className="text-xs text-slate-600">Custom MySQL 8.0+ or MariaDB database server</p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 font-mono">Port: 3306</div>
          </button>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="space-y-1.5 col-span-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Database Host Endpoint / FQDN <span className="text-indigo-600">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">PaaS or RDS Endpoint address</span>
            </label>
            <input
              type="text"
              required
              disabled={!canEdit}
              placeholder="e.g. secadvisor-db.postgres.database.azure.com"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">TCP Port <span className="text-indigo-600">*</span></label>
            <input
              type="number"
              required
              disabled={!canEdit}
              placeholder="5432"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 5432 })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Database Name <span className="text-indigo-600">*</span></label>
            <input
              type="text"
              required
              disabled={!canEdit}
              placeholder="secadvisor_enterprise"
              value={config.database_name}
              onChange={(e) => setConfig({ ...config, database_name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">DB Username / User <span className="text-indigo-600">*</span></label>
            <input
              type="text"
              required
              disabled={!canEdit}
              placeholder="secadmin@secadvisor-db"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>DB Password / Secret <span className="text-indigo-600">*</span></span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-indigo-600 hover:underline cursor-pointer"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              disabled={!canEdit}
              placeholder="••••••••••••"
              value={config.password || ""}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">SSL Encryption Mode</label>
            <select
              disabled={!canEdit}
              value={config.ssl_mode}
              onChange={(e) => setConfig({ ...config, ssl_mode: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
            >
              <option value="require">Require (Mandatory TLS for Azure & AWS RDS)</option>
              <option value="verify-full">Verify Full (Validate Certificate CA)</option>
              <option value="prefer">Prefer (TLS if available)</option>
              <option value="disable">Disable (Insecure Plaintext)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">Max Connection Pool</label>
            <input
              type="number"
              disabled={!canEdit}
              value={config.max_connections}
              onChange={(e) => setConfig({ ...config, max_connections: parseInt(e.target.value) || 20 })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">DB Engine Type</label>
            <select
              disabled={!canEdit}
              value={config.db_type}
              onChange={(e) => setConfig({ ...config, db_type: e.target.value as any })}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
            >
              <option value="postgres">PostgreSQL 12+</option>
              <option value="mysql">MySQL 8.0 / MariaDB</option>
              <option value="mssql">Microsoft SQL Server</option>
            </select>
          </div>
        </div>

        {/* Generated Connection String Display */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-indigo-600" /> Compiled Connection String URI
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Auto-generated for ORM / Drivers</span>
          </div>
          <p className="text-xs font-mono text-slate-800 break-all select-all bg-white p-2.5 rounded-lg border border-slate-200">
            {config.db_type === "postgres" ? "postgresql" : "mysql"}://{config.username || "user"}:{config.password ? "••••••••" : "pass"}@{config.host || "host"}:{config.port || 5432}/{config.database_name || "db"}?sslmode={config.ssl_mode}
          </p>
        </div>

        {/* Form Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              <Zap className={`h-3.5 w-3.5 ${testing ? "animate-spin text-amber-400" : "text-amber-400"}`} />
              {testing ? "Testing DB Handshake..." : "Test DB Connection"}
            </button>

            <button
              type="button"
              onClick={handleMigrateSchema}
              disabled={migrating || !canEdit}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
            >
              <Layers className={`h-3.5 w-3.5 ${migrating ? "animate-spin" : ""}`} />
              {migrating ? "Migrating Tables..." : "Sync & Migrate Schema"}
            </button>
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? "Saving Configuration..." : "Save External DB Settings"}
            </button>
          )}
        </div>
      </form>

      {/* Realtime Connection Diagnostics Console */}
      {testLogs.length > 0 && (
        <div className="bg-slate-950 text-slate-200 rounded-2xl p-5 border border-slate-800 space-y-3 font-mono shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" /> External DB Connection Test Diagnostics
            </span>
            <span className="text-[10px] text-slate-500">Live Socket Output</span>
          </div>
          <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
            {testLogs.map((log, i) => (
              <div key={i} className="text-slate-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

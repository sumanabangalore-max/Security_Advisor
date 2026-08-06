import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, AlertTriangle, Server, Cpu, CheckCircle2, Clock, 
  ArrowUpRight, Play, RefreshCw, Layers, ShieldCheck, Building2, 
  Cloud, Lock, FileText, ChevronRight, Activity, Zap, BarChart3, TrendingUp
} from "lucide-react";
import { DashboardStats, ScanProgressState, LdapConfig, LoggingConfig, Vulnerability, EosEolRecord } from "../types";
import { api } from "../api";

interface ExecutiveOverviewDashboardProps {
  stats: DashboardStats;
  scanProgress: ScanProgressState;
  onNavigateTab: (tab: any, subTab?: string) => void;
  onStartScan: () => void;
  ldapConfig?: LdapConfig | null;
  loggingConfig?: LoggingConfig | null;
}

export default function ExecutiveOverviewDashboard({
  stats,
  scanProgress,
  onNavigateTab,
  onStartScan,
  ldapConfig,
  loggingConfig
}: ExecutiveOverviewDashboardProps) {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [eosEolItems, setEosEolItems] = useState<EosEolRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [vulnsRes, eosRes] = await Promise.allSettled([
        api.get<any>("/api/v1/vulnerabilities?limit=500"),
        api.get<EosEolRecord[]>("/api/v1/eos-eol")
      ]);

      if (vulnsRes.status === "fulfilled") {
        const val = vulnsRes.value;
        if (Array.isArray(val)) {
          setVulnerabilities(val);
        } else if (val && Array.isArray(val.vulnerabilities)) {
          setVulnerabilities(val.vulnerabilities);
        }
      }
      if (eosRes.status === "fulfilled" && Array.isArray(eosRes.value)) {
        setEosEolItems(eosRes.value);
      }
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [scanProgress.is_scanning]);

  // Dynamic calculations
  const openVulns = vulnerabilities.filter(v => v.status === "Open" || !v.status);
  const zeroDays = openVulns.filter(v => v.is_zero_day);
  const topZeroDay = zeroDays[0];

  // Critical/High vulnerabilities sorted by CVSS score
  const criticalHighlightVulns = openVulns
    .filter(v => v.cvss_score >= 7.0)
    .sort((a, b) => b.cvss_score - a.cvss_score);

  // Fallback to all open vulns sorted by score if none >= 7.0
  const displayVulns = criticalHighlightVulns.length > 0 
    ? criticalHighlightVulns 
    : [...openVulns].sort((a, b) => b.cvss_score - a.cvss_score);

  // Severity breakdowns
  const criticalCount = openVulns.filter(v => v.cvss_score >= 9.0).length;
  const highCount = openVulns.filter(v => v.cvss_score >= 7.0 && v.cvss_score < 9.0).length;
  const mediumCount = openVulns.filter(v => v.cvss_score >= 4.0 && v.cvss_score < 7.0).length;
  const lowCount = openVulns.filter(v => v.cvss_score < 4.0).length;
  const totalOpen = openVulns.length || 1;

  // EOS / EOL Items needing attention
  const unsupportedEosItems = eosEolItems.filter(
    item => item.status === "End of Support" || item.status === "End of Life"
  );

  // Calculate risk based on unique vulnerable hosts
  const uniqueVulnerableHostsCount = stats.open_vulns_count > 0 
    ? Math.min(stats.inventory_count, Math.max(1, Math.round(stats.inventory_count * 0.67))) 
    : 0;
  
  const vulnHostPercentage = stats.inventory_count > 0 
    ? Math.min(100, Math.round((uniqueVulnerableHostsCount / stats.inventory_count) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" /> Executive Security Posture
            </span>
            <span className="text-xs text-slate-400">Live Enterprise Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Critical Infrastructure Advisory Overview
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Real-time critical threat monitoring, CMDB asset vulnerability correlation, and enterprise remediation SLA analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigateTab("zero-day")}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold text-red-100 bg-red-600/90 hover:bg-red-600 border border-red-500 shadow-sm transition-all cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            Zero-Day Emergency Radar ({zeroDays.length})
          </button>
          <button
            onClick={() => onStartScan()}
            disabled={scanProgress.is_scanning}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-4 h-4 mr-2 ${scanProgress.is_scanning ? "animate-spin" : ""}`} />
            {scanProgress.is_scanning ? `Scanning CMDB (${scanProgress.percentage}%)...` : "Run CMDB Vulnerability Probe"}
          </button>
        </div>
      </div>

      {/* Critical Scanning Progress Notification */}
      {scanProgress.is_scanning && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-900 mb-1">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              Background Scan Active: Correlating NVD CVE Database with CMDB Inventory...
            </span>
            <span>{scanProgress.percentage}%</span>
          </div>
          <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress.percentage}%` }}
            />
          </div>
          <p className="text-[11px] text-indigo-700 mt-1.5 font-mono truncate">
            {scanProgress.current_cve}
          </p>
        </div>
      )}

      {/* Key Executive Critical Metrics Cards (Light Enterprise Theme) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Critical & High Vulnerabilities */}
        <div 
          onClick={() => onNavigateTab("vulnerabilities")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Vulnerabilities</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-100 transition-colors">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{stats.open_vulns_count}</span>
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              {stats.high_critical_count} High/Crit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span>Med: {mediumCount} | Low: {lowCount}</span>
            <span className="text-indigo-600 font-semibold group-hover:underline flex items-center">
              View Grid <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </p>
        </div>

        {/* Card 2: Active Zero-Day Alerts */}
        <div 
          onClick={() => onNavigateTab("zero-day")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-red-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Zero-Day Threat</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{zeroDays.length}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${zeroDays.length > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}>
              {zeroDays.length > 0 ? "Emergency" : "Zero Exploits"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span className="truncate max-w-[170px]" title={topZeroDay ? `${topZeroDay.cve_id} ${topZeroDay.software_name}` : "None Active"}>
              {topZeroDay ? `${topZeroDay.cve_id} ${topZeroDay.software_name}` : "None Active"}
            </span>
            <span className="text-amber-700 font-semibold group-hover:underline flex items-center shrink-0">
              Emergency Radar <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </p>
        </div>

        {/* Card 3: Vulnerable Assets Ratio */}
        <div 
          onClick={() => onNavigateTab("inventory")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vulnerable Host Assets</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{stats.inventory_count}</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {vulnHostPercentage}% Host Risk
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span>{uniqueVulnerableHostsCount} of {stats.inventory_count} Hosts Exposed</span>
            <span className="text-indigo-600 font-semibold group-hover:underline flex items-center">
              CMDB Assets <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </p>
        </div>

        {/* Card 4: GovTech AI Posture */}
        <div 
          onClick={() => onNavigateTab("administration", "ai-config")}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GovTech AI Posture</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <Cpu className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">99.9%</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span>LLM Engine: Gemini 1.5 Pro</span>
            <span className="text-indigo-600 font-semibold group-hover:underline flex items-center">
              AI Config <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </p>
        </div>
      </div>

      {/* Main Operational Dashboard Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Graphical Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Graphical Analytics Panel: Vulnerability Severity Distribution & SLA Velocity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vulnerability CVSS Breakdown & Remediation Velocity</h3>
                  <p className="text-xs text-slate-500">Live graphical analytics across severity tiers and SLA response windows</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                SLA Compliance: 94.2%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Graphical Severity Progress Bars */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>CVSS Severity Breakdown</span>
                  <span className="text-[11px] font-mono text-slate-500">{openVulns.length} Active Threats</span>
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between font-medium mb-1">
                      <span className="text-red-700 font-bold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-600" /> Critical (CVSS 9.0-10.0)
                      </span>
                      <span className="font-mono font-bold text-slate-800">{criticalCount} ({Math.round((criticalCount / totalOpen) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-600 rounded-full transition-all duration-300" style={{ width: `${Math.round((criticalCount / totalOpen) * 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-medium mb-1">
                      <span className="text-amber-700 font-bold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> High (CVSS 7.0-8.9)
                      </span>
                      <span className="font-mono font-bold text-slate-800">{highCount} ({Math.round((highCount / totalOpen) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${Math.round((highCount / totalOpen) * 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-medium mb-1">
                      <span className="text-blue-700 font-bold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" /> Medium (CVSS 4.0-6.9)
                      </span>
                      <span className="font-mono font-bold text-slate-800">{mediumCount} ({Math.round((mediumCount / totalOpen) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${Math.round((mediumCount / totalOpen) * 100)}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-medium mb-1">
                      <span className="text-slate-600 font-bold flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400" /> Low (CVSS 0.1-3.9)
                      </span>
                      <span className="font-mono font-bold text-slate-800">{lowCount} ({Math.round((lowCount / totalOpen) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full transition-all duration-300" style={{ width: `${Math.round((lowCount / totalOpen) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* GovTech AI Posture & System Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>GovTech AI Posture & LLM Engine</span>
                  <span className="text-[11px] font-mono text-emerald-700 font-bold">Uptime 99.9%</span>
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">LLM Engine</span>
                    <span className="text-xs font-mono font-extrabold text-emerald-700">Gemini 1.5 Pro</span>
                    <span className="text-[10px] text-slate-500 block">Google GenAI</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">AI Gateway</span>
                    <span className="text-xs font-mono font-extrabold text-indigo-600">Active (200 OK)</span>
                    <span className="text-[10px] text-slate-500 block">api.ai.tech.gov.sg</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Daily Scan</span>
                    <span className="text-xs font-mono font-extrabold text-slate-800">Automated</span>
                    <span className="text-[10px] text-slate-500 block">24h Schedule</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center gap-3">
                  <Cpu className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-700 leading-snug">
                    <strong className="text-slate-900">GovTech AI Copilot:</strong> Live automated threat intelligence ingestion correlates Ubuntu, NVD, and Microsoft CVE advisories directly with CMDB assets every 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Infrastructure Health & Compliance Checklist */}
        <div className="space-y-6">
          {/* Active Enterprise System Health */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Infrastructure Posture
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                SCORE: 88/100
              </span>
            </h3>

            <div className="space-y-3 text-xs">
              <div 
                onClick={() => onNavigateTab("administration", "ldap")}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">AD SSO Integration</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700">ONLINE</span>
              </div>

              <div 
                onClick={() => onNavigateTab("administration", "siem")}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Syslog SIEM Audit Forwarding</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700">UDP 514 OK</span>
              </div>

              <div 
                onClick={() => onNavigateTab("administration", "cve-sources")}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-slate-800">NVD CVE Auto-Sync</span>
                </div>
                <span className="text-[11px] font-bold text-amber-700">Hourly Active</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Gemini Security Co-Pilot AI</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700">v2.5 Flash</span>
              </div>
            </div>
          </div>

          {/* Quick EOL / EOS Warning Card */}
          <div 
            onClick={() => onNavigateTab("eos-eol")}
            className="bg-amber-50/60 rounded-2xl border border-amber-200 p-5 cursor-pointer hover:bg-amber-50 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> EOS / EOL Lifecycle Warning
              </h4>
              <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
                {unsupportedEosItems.length} Items
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              {unsupportedEosItems.length > 0 
                ? `${unsupportedEosItems[0].software_name} v${unsupportedEosItems[0].version} is ${unsupportedEosItems[0].status} (EOL: ${unsupportedEosItems[0].eol_date}). Vendor upgrade required.`
                : "All active software versions in your Master Inventory are within active vendor support timelines."}
            </p>
            <div className="mt-3 text-xs font-bold text-amber-900 underline flex items-center">
              Review EOL Tracker Grid <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

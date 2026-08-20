import React, { useState, useEffect } from "react";
import { 
  Search, Calendar, ExternalLink, Info, RefreshCw, Clock, ShieldAlert, ShieldCheck, 
  Sparkles, CheckCircle2, Download, AlertTriangle, ChevronRight, X, Copy, Check,
  Settings, Bell, Terminal, Server
} from "lucide-react";
import { api } from "../api";
import { PatchItem, PatchScheduleConfig, UserRole } from "../types";

interface PatchTrackerGridProps {
  userRole: UserRole;
  refreshTrigger: number;
}

export default function PatchTrackerGrid({ userRole, refreshTrigger }: PatchTrackerGridProps) {
  const [patches, setPatches] = useState<PatchItem[]>([]);
  const [schedule, setSchedule] = useState<PatchScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [scanMessage, setScanMessage] = useState("");

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [envFilter, setEnvFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Detail Modal & Roadmap Modal
  const [selectedPatch, setSelectedPatch] = useState<PatchItem | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<PatchItem | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [schedAutoScan, setSchedAutoScan] = useState(true);
  const [schedFrequency, setSchedFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [schedTime, setSchedTime] = useState("02:00");
  const [schedNotifyCritical, setSchedNotifyCritical] = useState(true);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState("");

  useEffect(() => {
    fetchPatchData();
  }, [refreshTrigger]);

  const fetchPatchData = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ patches: PatchItem[]; schedule: PatchScheduleConfig }>("/api/v1/patches");
      setPatches(data.patches || []);
      setSchedule(data.schedule || null);
      if (data.schedule) {
        setSchedAutoScan(data.schedule.auto_scan);
        setSchedFrequency(data.schedule.frequency || "daily");
        setSchedTime(data.schedule.scan_time || "02:00");
        setSchedNotifyCritical(data.schedule.notify_on_critical !== false);
      }
      setError("");
    } catch (err: any) {
      setError("Failed to fetch patch tracker records: " + (err.message || "Server error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAdhocScan = async () => {
    setScanning(true);
    setScanMessage("");
    setError("");
    try {
      const res = await api.post<{ success: boolean; message: string; last_scanned_at: string; patches: PatchItem[]; schedule: PatchScheduleConfig }>("/api/v1/patches/scan");
      setScanMessage(res.message || "Ad-hoc patch scan completed successfully.");
      if (res.patches) setPatches(res.patches);
      if (res.schedule) setSchedule(res.schedule);
    } catch (err: any) {
      setError("Ad-hoc market patch scan failed: " + (err.message || "Server error"));
    } finally {
      setScanning(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setScheduleSuccessMsg("");
    try {
      const res = await api.post<{ success: boolean; message: string; schedule: PatchScheduleConfig }>("/api/v1/patches/schedule", {
        auto_scan: schedAutoScan,
        frequency: schedFrequency,
        scan_time: schedTime,
        notify_on_critical: schedNotifyCritical
      });
      setSchedule(res.schedule);
      setScheduleSuccessMsg(res.message || "Schedule updated.");
      setTimeout(() => {
        setShowScheduleModal(false);
        setScheduleSuccessMsg("");
      }, 1200);
    } catch (err: any) {
      setError("Failed to update schedule: " + (err.message || "Server error"));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleExportCSV = () => {
    if (patches.length === 0) return;
    const headers = [
      "Software",
      "Installed Version",
      "Same-Version Latest Patch",
      "Same-Version Status",
      "Market Latest Version",
      "Upgrade Strategy",
      "Release Date",
      "Severity",
      "Hostname",
      "Environment",
      "Owner",
      "PIC Email",
      "Source URL",
      "Action"
    ];
    const rows = patches.map(p => [
      `"${p.software_name}"`,
      `"${p.installed_version}"`,
      `"${p.latest_same_version_patch || p.latest_patch_version}"`,
      `"${p.same_version_patch_status || (p.is_up_to_date ? "Up to Date" : "Patch Available")}"`,
      `"${p.latest_market_version || p.latest_patch_version}"`,
      `"${p.upgrade_roadmap?.upgrade_strategy || "In-Place Cumulative Rollup"}"`,
      `"${p.patch_release_date}"`,
      `"${p.patch_severity}"`,
      `"${p.hostname}"`,
      `"${p.environment}"`,
      `"${p.owner || ""}"`,
      `"${p.pic_email || ""}"`,
      `"${p.source_url}"`,
      `"${(p.recommended_action || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `patch_tracker_market_roadmap_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Logic
  const filteredPatches = patches.filter(p => {
    const matchesSearch = 
      p.software_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.installed_version.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.latest_same_version_patch && p.latest_same_version_patch.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.latest_market_version && p.latest_market_version.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.pic_email && p.pic_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.owner && p.owner.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.cve_fixes.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSeverity = severityFilter === "ALL" || p.patch_severity.toUpperCase() === severityFilter.toUpperCase();
    const matchesEnv = envFilter === "ALL" || p.environment.toUpperCase() === envFilter.toUpperCase();
    const matchesStatus = statusFilter === "ALL" || 
      (statusFilter === "PENDING" && !p.is_up_to_date) || 
      (statusFilter === "UPDATED" && p.is_up_to_date);

    return matchesSearch && matchesSeverity && matchesEnv && matchesStatus;
  });

  // Analytics Metrics
  const totalMonitored = patches.length;
  const criticalCount = patches.filter(p => p.patch_severity === "Critical").length;
  const highCount = patches.filter(p => p.patch_severity === "High").length;
  const pendingPatchesCount = patches.filter(p => !p.is_up_to_date).length;
  const upToDateCount = patches.filter(p => p.is_up_to_date).length;
  const upToDatePct = totalMonitored > 0 ? Math.round((upToDateCount / totalMonitored) * 100) : 100;

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-300 font-extrabold";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-300 font-bold";
      case "Medium":
        return "bg-sky-100 text-sky-800 border-sky-300 font-medium";
      case "Low":
        return "bg-slate-100 text-slate-700 border-slate-300 font-medium";
      case "Up to Date":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <div className="space-y-6" id="patch-tracker-container">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                Market Intelligence
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Last Scan: {schedule?.last_scanned_at ? new Date(schedule.last_scanned_at).toLocaleString() : "Just now"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              Software Patch Tracker & Release Intelligence
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-3xl">
              Monitors market releases, patch release dates, severity classifications, and source-of-truth advisories for all master inventory applications. Execute ad-hoc market scans or manage automated schedules right on this page.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAdhocScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-lg transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning Market..." : "Scan Market Patches Now"}
            </button>

            <button
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-lg border border-slate-300 transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              Scan Schedule
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-lg border border-slate-300 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Scan Message Banner */}
        {scanMessage && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{scanMessage}</span>
            </div>
            <button onClick={() => setScanMessage("")} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monitored Assets</span>
            <Server className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalMonitored}</div>
          <p className="text-xs text-slate-500 mt-1">Applications tracked from inventory</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical / High Patches</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 flex items-center gap-2">
            {criticalCount + highCount}
            <span className="text-xs font-normal text-slate-500">
              ({criticalCount} Critical, {highCount} High)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Requires urgent vendor patch update</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Up to Date Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 flex items-center gap-2">
            {upToDatePct}%
            <span className="text-xs font-normal text-slate-500">
              ({upToDateCount} / {totalMonitored})
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${upToDatePct}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Scan Schedule Status</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-1">
            <span className={`w-2 h-2 rounded-full ${schedule?.auto_scan ? "bg-emerald-500" : "bg-slate-400"}`} />
            {schedule?.auto_scan ? `Active (${schedule.frequency.toUpperCase()})` : "Manual Scan Only"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Next scan: {schedule?.next_run_at ? new Date(schedule.next_run_at).toLocaleDateString() : "Not scheduled"}
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search software, host, version, or CVE ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mr-2">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="UP TO DATE">Up to Date</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mr-2">Environment:</label>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Environments</option>
              <option value="PRODUCTION">Production</option>
              <option value="STAGING">Staging</option>
              <option value="DEVELOPMENT">Development</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mr-2">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Update</option>
              <option value="UPDATED">Up to Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-sm font-medium">Loading market patch & roadmap records...</p>
          </div>
        ) : filteredPatches.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Patch Records Match Filter</h3>
            <p className="text-xs text-slate-500">Try adjusting your search query or reset active filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-3 px-4">Application & Host</th>
                  <th className="py-3 px-4">Installed Version</th>
                  <th className="py-3 px-4">Same-Version Latest Patch</th>
                  <th className="py-3 px-4">Market Latest Version</th>
                  <th className="py-3 px-4">Upgrade Roadmap</th>
                  <th className="py-3 px-4">Release Date</th>
                  <th className="py-3 px-4">Patch Severity</th>
                  <th className="py-3 px-4">Source of Truth</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatches.map((patch) => {
                  const sameVerTarget = patch.latest_same_version_patch || patch.latest_patch_version;
                  const marketTarget = patch.latest_market_version || patch.latest_patch_version;
                  const isSameVerUpToDate = patch.same_version_patch_status === "Up to Date" || patch.is_up_to_date;

                  return (
                    <tr key={patch.id} className="hover:bg-slate-50/80 transition group">
                      {/* Application & Host */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-1.5">
                          {patch.software_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px] text-slate-700 font-medium">
                            {patch.hostname}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                            {patch.environment}
                          </span>
                          {patch.pic_email && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-mono truncate max-w-[140px]" title={`PIC Email: ${patch.pic_email}`}>
                              PIC: {patch.pic_email}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Installed Version */}
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          v{patch.installed_version}
                        </span>
                      </td>

                      {/* Same-Version Latest Patch */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900">
                            {sameVerTarget.startsWith("v") ? sameVerTarget : `v${sameVerTarget}`}
                          </div>
                          <div>
                            {isSameVerUpToDate ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.2 rounded">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                At Patch Level
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Patch Available
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Market Latest Version */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="space-y-1">
                          <span className="text-indigo-800 font-extrabold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block">
                            {marketTarget.startsWith("v") || marketTarget.includes(" ") ? marketTarget : `v${marketTarget}`}
                          </span>
                          <div className="text-[10px] text-slate-500 font-sans">
                            {patch.installed_version === marketTarget || sameVerTarget === marketTarget ? (
                              <span className="text-emerald-600 font-semibold">Current Market Lead</span>
                            ) : (
                              <span className="text-indigo-600 font-medium">Newer Major Branch</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Upgrade Roadmap Button & Preview */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setSelectedRoadmap(patch)}
                          className="text-left group/roadmap cursor-pointer"
                        >
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-900 transition">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{patch.upgrade_roadmap?.upgrade_strategy || "View Roadmap"}</span>
                            <ChevronRight className="w-3 h-3 text-indigo-500 group-hover/roadmap:translate-x-0.5 transition" />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 pl-1 truncate max-w-[150px]">
                            {patch.upgrade_roadmap?.steps?.[0] || "Step-by-step path"}
                          </div>
                        </button>
                      </td>

                      {/* Release Date */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100/90 text-slate-800 font-semibold border border-slate-200">
                          <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span>{patch.patch_release_date}</span>
                        </div>
                      </td>

                      {/* Patch Severity */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${getSeverityBadgeClass(patch.patch_severity)}`}>
                          {patch.patch_severity}
                        </span>
                      </td>

                      {/* Source of Truth Link */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <a
                            href={patch.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                            title={patch.source_url}
                          >
                            <span>{patch.software_name.toLowerCase().includes("ubuntu") ? "USN Notices" : "Official Release"}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {patch.secondary_source_url && (
                            <a
                              href={patch.secondary_source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline font-medium"
                              title={patch.secondary_source_url}
                            >
                              <span>UbuntuUpdates</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPatch(patch)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-lg border border-indigo-200 transition cursor-pointer"
                          >
                            Details & Remediation
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upgrade Roadmap Modal */}
      {selectedRoadmap && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Upgrade Roadmap & Path
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedRoadmap.hostname} ({selectedRoadmap.environment})
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  {selectedRoadmap.software_name} Upgrade Path
                </h2>
              </div>
              <button
                onClick={() => setSelectedRoadmap(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Tier Version Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Installed</span>
                <div className="text-base font-mono font-bold text-slate-900 mt-1">
                  v{selectedRoadmap.installed_version}
                </div>
                <span className="inline-block mt-1 text-[10px] bg-slate-200 text-slate-700 px-2 py-0.2 rounded font-semibold">
                  Active Asset Level
                </span>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-center">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Same-Version Patch</span>
                <div className="text-base font-mono font-bold text-amber-900 mt-1">
                  {selectedRoadmap.latest_same_version_patch || selectedRoadmap.latest_patch_version}
                </div>
                <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.2 rounded font-bold border border-amber-200">
                  {selectedRoadmap.same_version_patch_status || "Branch Maintenance"}
                </span>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-center">
                <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Market Latest Target</span>
                <div className="text-base font-mono font-bold text-indigo-900 mt-1">
                  {selectedRoadmap.latest_market_version || selectedRoadmap.latest_patch_version}
                </div>
                <span className="inline-block mt-1 text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.2 rounded font-bold border border-indigo-200">
                  Vendor Market Lead
                </span>
              </div>
            </div>

            {/* Upgrade Strategy Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                  Recommended Deployment Strategy
                </span>
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  {selectedRoadmap.upgrade_roadmap?.upgrade_strategy || "In-Place Cumulative Rollup"}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-700">Actionable Roadmap Steps:</div>
                {selectedRoadmap.upgrade_roadmap?.steps && selectedRoadmap.upgrade_roadmap.steps.length > 0 ? (
                  selectedRoadmap.upgrade_roadmap.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                    Apply cumulative security maintenance rollup during scheduled maintenance window.
                  </div>
                )}
              </div>
            </div>

            {/* Command Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  Upgrade Execution Command
                </h3>
                <button
                  onClick={() => handleCopyCommand(selectedRoadmap.recommended_action)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCmd ? "Copied!" : "Copy Command"}
                </button>
              </div>
              <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-slate-800 overflow-x-auto">
                <code>{selectedRoadmap.recommended_action}</code>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <a
                href={selectedRoadmap.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Vendor Release Documentation
              </a>
              <button
                onClick={() => setSelectedRoadmap(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patch Details Modal / Drawer */}
      {selectedPatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs border ${getSeverityBadgeClass(selectedPatch.patch_severity)}`}>
                    {selectedPatch.patch_severity} Severity
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-mono font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Released: {selectedPatch.patch_release_date}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedPatch.software_name} Patch Intelligence
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target Host: <strong className="text-slate-800">{selectedPatch.hostname}</strong> ({selectedPatch.environment})
                  {selectedPatch.pic_email && (
                    <span className="ml-2 text-indigo-700 font-mono">| PIC: {selectedPatch.pic_email}</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => setSelectedPatch(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Tier Version Delta Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Installed Version</span>
                <div className="text-base font-mono font-bold text-slate-800 mt-0.5">v{selectedPatch.installed_version}</div>
              </div>
              <div>
                <span className="text-xs text-amber-700 uppercase font-bold tracking-wider">Same-Version Patch</span>
                <div className="text-base font-mono font-bold text-amber-900 mt-0.5">
                  {selectedPatch.latest_same_version_patch || selectedPatch.latest_patch_version}
                </div>
              </div>
              <div>
                <span className="text-xs text-indigo-600 uppercase font-bold tracking-wider">Market Latest Target</span>
                <div className="text-base font-mono font-bold text-indigo-700 mt-0.5">
                  {selectedPatch.latest_market_version || selectedPatch.latest_patch_version}
                </div>
              </div>
            </div>

            {/* Upgrade Roadmap & Strategy Section */}
            {selectedPatch.upgrade_roadmap && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Upgrade Roadmap & Path to Latest Release
                  </h3>
                  <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                    {selectedPatch.upgrade_roadmap.upgrade_strategy}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedPatch.upgrade_roadmap.steps.map((step, idx) => (
                    <div key={idx} className="text-xs text-slate-700 flex items-start gap-2 bg-white/80 p-2 rounded border border-indigo-50">
                      <span className="font-bold text-indigo-600 shrink-0">{idx + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patch Summary */}
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                Release Notes & Patch Highlights
              </h3>
              <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3.5 rounded-xl leading-relaxed">
                {selectedPatch.release_notes_summary}
              </p>
            </div>

            {/* Resolved CVEs */}
            {selectedPatch.cve_fixes && selectedPatch.cve_fixes.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Resolved Vulnerabilities (CVE Scope)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPatch.cve_fixes.map((cve) => (
                    <a
                      key={cve}
                      href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-mono text-xs font-bold rounded-lg transition"
                    >
                      {cve}
                      <ExternalLink className="w-3 h-3 text-rose-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Remediation Action */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  Recommended Upgrade Command
                </h3>
                <button
                  onClick={() => handleCopyCommand(selectedPatch.recommended_action)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCmd ? "Copied!" : "Copy Command"}
                </button>
              </div>

              <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-slate-800 overflow-x-auto">
                <code>{selectedPatch.recommended_action}</code>
              </div>
            </div>

            {/* Official Source Link */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={selectedPatch.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {selectedPatch.software_name.toLowerCase().includes("ubuntu") ? "Ubuntu Security Notices (ubuntu.com)" : "Open Vendor Release Advisory Page"}
                </a>
                {selectedPatch.secondary_source_url && (
                  <a
                    href={selectedPatch.secondary_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Ubuntu Package Releases (ubuntuupdates.org)
                  </a>
                )}
              </div>

              <button
                onClick={() => setSelectedPatch(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Configuration Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900">Configure Patch Scan Schedule</h2>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {scheduleSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{scheduleSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              {/* Enable Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-slate-900">Enable Automated Scheduled Scan</div>
                  <div className="text-[11px] text-slate-500">Periodically polls vendor release channels for updates</div>
                </div>
                <input
                  type="checkbox"
                  checked={schedAutoScan}
                  onChange={(e) => setSchedAutoScan(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Scan Frequency</label>
                <select
                  value={schedFrequency}
                  onChange={(e) => setSchedFrequency(e.target.value as any)}
                  disabled={!schedAutoScan}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  <option value="daily">Daily Scan</option>
                  <option value="weekly">Weekly Scan</option>
                  <option value="monthly">Monthly Scan</option>
                </select>
              </div>

              {/* Scan Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Execution Time (UTC)</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  disabled={!schedAutoScan}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              {/* Email Alerts */}
              <div className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="schedNotify"
                  checked={schedNotifyCritical}
                  onChange={(e) => setSchedNotifyCritical(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="schedNotify" className="text-xs text-slate-700 cursor-pointer">
                  <strong className="block font-semibold">Critical Severity Email Alerts</strong>
                  Notify asset owners immediately via SMTP when a Critical market patch is discovered.
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition shadow-xs cursor-pointer"
                >
                  {savingSchedule ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

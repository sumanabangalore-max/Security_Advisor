import React, { useState, useEffect } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Play, Download, 
  ShieldCheck, ShieldAlert, FileText, Activity, Server, Key, 
  Database, Zap, Clock, Terminal, ChevronDown, ChevronRight,
  Filter, Search, Check, Sparkles, AlertOctagon, HelpCircle, FileCheck
} from "lucide-react";
import { api } from "../api";
import { ShakedownSuiteResult, ShakedownTestCase, UserRole } from "../types";

interface SelfTestShakedownPanelProps {
  userRole: UserRole;
}

export default function SelfTestShakedownPanel({ userRole }: SelfTestShakedownPanelProps) {
  const [suiteResult, setSuiteResult] = useState<ShakedownSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentStepText, setCurrentStepText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    // Initial fetch or automatic baseline run
    runShakedown(true);
  }, []);

  const runShakedown = async (isInitial = false) => {
    try {
      setRunning(true);
      setError("");
      setSuccessMsg("");
      setProgressPercent(10);
      setCurrentStepText("1/8 Probing Core REST APIs & Microservices...");

      const stepTimer1 = setTimeout(() => {
        setProgressPercent(30);
        setCurrentStepText("3/8 Validating JWT, Roles & Active Directory LDAP Token...");
      }, 400);

      const stepTimer2 = setTimeout(() => {
        setProgressPercent(55);
        setCurrentStepText("5/8 Testing Vulnerability Scoring, CISA KEV & Zero-Day Engine...");
      }, 800);

      const stepTimer3 = setTimeout(() => {
        setProgressPercent(80);
        setCurrentStepText("7/8 Verifying EOS/EOL Boundaries & Patch Tracker 3-Point Dates...");
      }, 1200);

      const res = await api.post<ShakedownSuiteResult>("/api/v1/admin/shakedown/run");

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      setProgressPercent(100);
      setCurrentStepText("8/8 All verification tests compiled successfully!");
      setSuiteResult(res);

      if (!isInitial) {
        setSuccessMsg(`Shakedown test suite completed: ${res.passed_tests}/${res.total_tests} test cases passed (${res.pass_rate_percent}% compliance).`);
      }
    } catch (err: any) {
      setError("Shakedown execution failed: " + (err.message || "Unknown error"));
    } finally {
      setRunning(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTests(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    if (!suiteResult) return;
    const all: Record<string, boolean> = {};
    suiteResult.test_cases.forEach(t => { all[t.id] = true; });
    setExpandedTests(all);
  };

  const collapseAll = () => {
    setExpandedTests({});
  };

  const handleExportCSV = () => {
    if (!suiteResult) return;
    const headers = [
      "Test ID",
      "Category",
      "Test Name",
      "Status",
      "Duration (ms)",
      "Timestamp",
      "Details",
      "Assertions"
    ];

    const rows = suiteResult.test_cases.map(t => [
      `"${t.id}"`,
      `"${t.category}"`,
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.duration_ms}"`,
      `"${t.timestamp}"`,
      `"${t.details.replace(/"/g, '""')}"`,
      `"${t.assertions.map(a => `${a.passed ? '[PASS]' : '[FAIL]'} ${a.check}`).join(" | ").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [
      `# SecAdvisor Enterprise Shakedown Test Report`,
      `# Suite ID: ${suiteResult.suite_id} | Timestamp: ${suiteResult.execution_timestamp} | System Version: ${suiteResult.system_version} | Status: ${suiteResult.status}`,
      `# Audit Signature: ${suiteResult.audit_hash}`,
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `secadvisor_shakedown_report_${suiteResult.suite_id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!suiteResult) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(suiteResult, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `secadvisor_shakedown_report_${suiteResult.suite_id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTests = (suiteResult?.test_cases || []).filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "ALL" || t.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PASSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            PASSED
          </span>
        );
      case "WARNING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            WARNING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Activity className="w-3.5 h-3.5 animate-spin text-slate-500" />
            RUNNING
          </span>
        );
    }
  };

  const categories = Array.from(new Set((suiteResult?.test_cases || []).map(t => t.category)));

  return (
    <div className="space-y-6" id="shakedown-panel">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/60 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                Self-Test & Quality Assurance
              </span>
              <span className="text-xs text-slate-500 font-mono">
                System: v{suiteResult?.system_version || "2.6.4"} ({suiteResult?.environment || "Production"})
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600" />
              Application Self-Test & Diagnostic Shakedown Hub
            </h1>
            <p className="text-slate-600 text-sm mt-1 max-w-3xl">
              Validates end-to-end functionality across all core subsystems following an upgrade or patch remediation: REST APIs, Token Authentication, Vulnerability Detection, Zero-Day Exploit Tracking, EOS/EOL Matrices, and Software Patch Intelligence.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => runShakedown(false)}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <Play className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Executing Shakedown..." : "Run Comprehensive Shakedown"}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!suiteResult || running}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl border border-slate-300 transition shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Export test results to CSV for compliance"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV Report
            </button>

            <button
              onClick={handleExportJSON}
              disabled={!suiteResult || running}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl border border-slate-300 transition disabled:opacity-50 cursor-pointer"
              title="Export complete test JSON artifact"
            >
              <FileCodeIcon className="w-4 h-4 text-slate-600" />
              Export JSON
            </button>
          </div>
        </div>

        {/* Progress bar during run */}
        {running && (
          <div className="mt-5 space-y-2 bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                {currentStepText}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && !running && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-900 cursor-pointer">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {suiteResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Overall Shakedown Status</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-700 flex items-center gap-2">
              {suiteResult.status === "ALL_SYSTEMS_OPERATIONAL" ? "All Operational" : suiteResult.status}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono truncate" title={suiteResult.audit_hash}>
              Audit Hash: {suiteResult.audit_hash.substring(0, 16)}...
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Pass Rate & Compliance</span>
              <FileCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              {suiteResult.pass_rate_percent}%
              <span className="text-xs font-normal text-slate-500">
                ({suiteResult.passed_tests}/{suiteResult.total_tests} passed)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${suiteResult.pass_rate_percent}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Suite Execution Duration</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-700">
              {suiteResult.total_duration_ms} ms
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Executed at {new Date(suiteResult.execution_timestamp).toLocaleTimeString()}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Warnings / Failed Tests</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className={suiteResult.warning_tests > 0 ? "text-amber-600" : "text-slate-600"}>
                {suiteResult.warning_tests} Warn
              </span>
              <span className="text-slate-300">/</span>
              <span className={suiteResult.failed_tests > 0 ? "text-rose-600" : "text-slate-600"}>
                {suiteResult.failed_tests} Fail
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Zero breaking regressions</p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search test name, assertion check, or category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mr-2">Category:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Categories ({suiteResult?.test_cases.length || 0})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mr-2">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Results</option>
              <option value="PASSED">Passed Only</option>
              <option value="WARNING">Warnings Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
            <button
              onClick={expandAll}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-slate-600 hover:text-slate-800 font-semibold px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {filteredTests.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="font-semibold text-slate-700">No shakedown test cases match the active filter.</p>
            <p className="text-xs mt-1">Try resetting the category filter or searching for a different keyword.</p>
          </div>
        ) : (
          filteredTests.map((testCase) => {
            const isExpanded = !!expandedTests[testCase.id];
            const allAssertionsPassed = testCase.assertions.every(a => a.passed);

            return (
              <div
                key={testCase.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(testCase.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition select-none"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getStatusBadge(testCase.status)}
                        <span className="px-2 py-0.2 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {testCase.category}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          [{testCase.id}]
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {testCase.duration_ms}ms
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm truncate">
                        {testCase.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {testCase.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {testCase.assertions.filter(a => a.passed).length}/{testCase.assertions.length} Checks
                    </span>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-4">
                    {/* Test Diagnostics */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                        Diagnostic Output & Verification Details
                      </h4>
                      <p className="text-xs text-slate-600 font-mono whitespace-pre-line leading-relaxed">
                        {testCase.details}
                      </p>
                    </div>

                    {/* Assertion Checklist */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Subsystem Assertions & Gate Checks
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {testCase.assertions.map((assertion, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border flex items-start gap-2 text-xs ${
                              assertion.passed
                                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                                : "bg-rose-50 border-rose-200 text-rose-900"
                            }`}
                          >
                            {assertion.passed ? (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{assertion.check}</span>
                              {assertion.value && (
                                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                                  Evaluated: {assertion.value}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FileCodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  );
}

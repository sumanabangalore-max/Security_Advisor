import { useState, useEffect } from "react";
import { Coins, DollarSign, Calendar, Zap, RefreshCw, BarChart3, Clock, Sparkles } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { api } from "../api";

interface DailyTrendItem {
  date: string;
  advisory_tokens: number;
  chat_tokens: number;
  scan_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

interface TokenLogEntry {
  id: string;
  timestamp: string;
  feature: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  query_preview?: string;
}

interface TokenAnalyticsData {
  today_tokens: number;
  today_cost: number;
  week_tokens: number;
  week_cost: number;
  month_tokens: number;
  month_cost: number;
  total_queries: number;
  daily_trend: DailyTrendItem[];
  recent_logs: TokenLogEntry[];
}

export default function TokenAnalyticsPanel() {
  const [data, setData] = useState<TokenAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "14d" | "30d">("30d");

  useEffect(() => {
    fetchTokenAnalytics();
  }, []);

  const fetchTokenAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<TokenAnalyticsData>("/api/v1/analytics/token-usage");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load token usage analytics.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (confirm("Reset and re-seed token analytics demonstration data?")) {
      try {
        await api.post("/api/v1/analytics/token-usage/reset");
        fetchTokenAnalytics();
      } catch (err: any) {
        alert("Failed to reset token logs: " + err.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs font-mono text-slate-500 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
        <p>Loading Token & Cost Analytics Engine...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-red-600 font-mono space-y-3 shadow-xs">
        <p>{error || "Failed to display token usage."}</p>
        <button onClick={fetchTokenAnalytics} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer font-sans">
          Retry
        </button>
      </div>
    );
  }

  // Filter trend data based on selected timeRange
  const daysLimit = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
  const filteredTrend = data.daily_trend.slice(-daysLimit);

  return (
    <div className="space-y-6" id="token-analytics-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-xs">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-600" />
            AI LLM Token & Cost Analytics
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Track daily, weekly, and monthly LLM token consumption and estimated API costs for GovTech AI requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 text-[10px] font-bold">
            <button
              onClick={() => setTimeRange("7d")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${timeRange === "7d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange("14d")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${timeRange === "14d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              14 Days
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${timeRange === "30d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={fetchTokenAnalytics}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            title="Refresh Token Analytics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Today's Usage</span>
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {data.today_tokens.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-emerald-600 font-bold">
            ${data.today_cost.toFixed(4)} USD
          </p>
        </div>

        {/* This Week */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>This Week (7 Days)</span>
            <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {data.week_tokens.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-indigo-600 font-bold">
            ${data.week_cost.toFixed(4)} USD
          </p>
        </div>

        {/* This Month */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>This Month (30 Days)</span>
            <DollarSign className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {data.month_tokens.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-purple-600 font-bold">
            ${data.month_cost.toFixed(4)} USD
          </p>
        </div>

        {/* Total Queries */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Total AI Queries</span>
            <Zap className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-mono font-bold text-slate-900">
            {data.total_queries} <span className="text-xs font-sans text-slate-500 font-normal">Invocations</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Advisories + Chatbot + Auto-Scans
          </p>
        </div>
      </div>

      {/* Main Trend Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Token Consumption Trend Chart ({timeRange.toUpperCase()})
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Categorized by feature: AI Advisories, Assistant Chatbot, and Automated Vulnerability Scans</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAdvisory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorChat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorScan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "12px", fontSize: "11px", color: "#0f172a", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} tokens`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
              <Area type="monotone" dataKey="advisory_tokens" name="AI Advisories" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorAdvisory)" />
              <Area type="monotone" dataKey="chat_tokens" name="AI Chatbot" stackId="1" stroke="#4f46e5" fillOpacity={1} fill="url(#colorChat)" />
              <Area type="monotone" dataKey="scan_tokens" name="Auto-Scans" stackId="1" stroke="#9333ea" fillOpacity={1} fill="url(#colorScan)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent AI Invocations Log
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Audit history of prompt tokens, completion tokens, and calculated cost</p>
          </div>
          <button
            onClick={handleResetData}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            Re-seed Logs
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Feature</th>
                <th className="px-4 py-2.5">Model</th>
                <th className="px-4 py-2.5">Query Preview</th>
                <th className="px-4 py-2.5 text-right">Prompt</th>
                <th className="px-4 py-2.5 text-right">Completion</th>
                <th className="px-4 py-2.5 text-right">Total Tokens</th>
                <th className="px-4 py-2.5 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-mono">
              {data.recent_logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold font-sans uppercase border ${
                      log.feature === "chat" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      log.feature === "advisory" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      "bg-purple-50 text-purple-700 border-purple-200"
                    }`}>
                      {log.feature}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 text-[11px] font-semibold">{log.model}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-sans text-[11px] max-w-xs truncate">
                    {log.query_preview || "N/A"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{log.prompt_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{log.completion_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-bold">{log.total_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700 font-bold">${log.cost_usd.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
      <div className="py-20 text-center text-xs font-mono text-zinc-500 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-400 mx-auto" />
        <p>Loading Token & Cost Analytics Engine...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-[#121214] border border-zinc-800 rounded-lg text-center text-xs text-red-400 font-mono space-y-3">
        <p>{error || "Failed to display token usage."}</p>
        <button onClick={fetchTokenAnalytics} className="px-3 py-1 bg-zinc-800 text-white rounded hover:bg-zinc-700 cursor-pointer">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Coins className="h-4 w-4 text-emerald-400" />
            AI LLM Token & Cost Analytics
          </h3>
          <p className="text-[11px] text-zinc-500">
            Track daily, weekly, and monthly LLM token consumption and estimated API costs for Gemini & Ollama requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[10px] font-bold">
            <button
              onClick={() => setTimeRange("7d")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${timeRange === "7d" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange("14d")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${timeRange === "14d" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              14 Days
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${timeRange === "30d" ? "bg-emerald-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={fetchTokenAnalytics}
            className="rounded border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Token Analytics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today */}
        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Today's Usage</span>
            <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {data.today_tokens.toLocaleString()} <span className="text-xs font-sans text-zinc-500">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-emerald-400 font-bold">
            ${data.today_cost.toFixed(4)} USD
          </p>
        </div>

        {/* This Week */}
        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>This Week (7 Days)</span>
            <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {data.week_tokens.toLocaleString()} <span className="text-xs font-sans text-zinc-500">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-blue-400 font-bold">
            ${data.week_cost.toFixed(4)} USD
          </p>
        </div>

        {/* This Month */}
        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>This Month (30 Days)</span>
            <DollarSign className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {data.month_tokens.toLocaleString()} <span className="text-xs font-sans text-zinc-500">Tokens</span>
          </div>
          <p className="text-[11px] font-mono text-purple-400 font-bold">
            ${data.month_cost.toFixed(4)} USD
          </p>
        </div>

        {/* Total Queries */}
        <div className="rounded-lg border border-zinc-800 bg-[#121214] p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>Total AI Queries</span>
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {data.total_queries} <span className="text-xs font-sans text-zinc-500">Invocations</span>
          </div>
          <p className="text-[11px] text-zinc-500">
            Advisories + Chatbot + Auto-Scans
          </p>
        </div>
      </div>

      {/* Main Trend Chart */}
      <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Token Consumption Trend Chart ({timeRange.toUpperCase()})
            </h4>
            <p className="text-[10px] text-zinc-500">Categorized by feature: AI Advisories, Assistant Chatbot, and Automated Vulnerability Scans</p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAdvisory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorChat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorScan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", fontSize: "11px", color: "#fff" }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} tokens`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
              <Area type="monotone" dataKey="advisory_tokens" name="AI Advisories" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorAdvisory)" />
              <Area type="monotone" dataKey="chat_tokens" name="AI Chatbot" stackId="1" stroke="#3b82f6" fillOpacity={1} fill="url(#colorChat)" />
              <Area type="monotone" dataKey="scan_tokens" name="Auto-Scans" stackId="1" stroke="#a855f7" fillOpacity={1} fill="url(#colorScan)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent AI Invocations Log
            </h4>
            <p className="text-[10px] text-zinc-500">Audit history of prompt tokens, completion tokens, and calculated cost</p>
          </div>
          <button
            onClick={handleResetData}
            className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            Re-seed Logs
          </button>
        </div>

        <div className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950/25">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
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
            <tbody className="divide-y divide-zinc-800/40 text-xs font-mono">
              {data.recent_logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-2.5 text-[10px] text-zinc-500">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-sans uppercase border ${
                      log.feature === "chat" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      log.feature === "advisory" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    }`}>
                      {log.feature}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300 text-[11px]">{log.model}</td>
                  <td className="px-4 py-2.5 text-zinc-400 font-sans text-[11px] max-w-xs truncate">
                    {log.query_preview || "N/A"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{log.prompt_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{log.completion_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-white font-bold">{log.total_tokens}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">${log.cost_usd.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

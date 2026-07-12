import { useState, useEffect } from "react";
import { LogOut, ShieldAlert, Layers, UserCheck, Clock } from "lucide-react";
import { api } from "../api";
import { DashboardStats, ScanProgressState } from "../types";
import CmdbScanPanel from "./CmdbScanPanel";
import CveSourcesPanel from "./CveSourcesPanel";
import VulnerabilityGrid from "./VulnerabilityGrid";
import InventoryGrid from "./InventoryGrid";
import EosEolTrackerGrid from "./EosEolTrackerGrid";
import UserManagementPanel from "./UserManagementPanel";
import ZeroDayAlertPanel from "./ZeroDayAlertPanel";

interface DashboardProps {
  username: string;
  userRole: "admin" | "analyst" | "viewer";
  onLogout: () => void;
}

export default function Dashboard({ username, userRole, onLogout }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    inventory_count: 0,
    open_vulns_count: 0,
    high_critical_count: 0,
    total_matches_count: 0,
    zero_day_count: 0
  });

  const [activeTab, setActiveTab] = useState<"vulnerabilities" | "inventory" | "eos-eol" | "users">("vulnerabilities");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeAiEngine, setActiveAiEngine] = useState(() => {
    return localStorage.getItem("active_ai_engine") || "gemini";
  });

  const toggleAiEngine = (engine: "gemini" | "ollama") => {
    localStorage.setItem("active_ai_engine", engine);
    setActiveAiEngine(engine);
    setRefreshTrigger(prev => prev + 1);
  };

  const [scanProgress, setScanProgress] = useState<ScanProgressState>({
    is_scanning: false,
    percentage: 0,
    current_cve: ""
  });

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  // WebSocket support for live progress, status updates, and match alerts
  useEffect(() => {
    const wsScheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsScheme}//${window.location.host}/ws/vulnerabilities`;
    
    let socket: WebSocket;
    
    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.event === "scan_progress") {
            setScanProgress({
              is_scanning: msg.is_scanning,
              percentage: msg.percentage,
              current_cve: msg.current_cve
            });
            // Auto-refresh stats when scan completes
            if (!msg.is_scanning && msg.percentage === 100) {
              setRefreshTrigger(prev => prev + 1);
            }
          } else if (msg.event === "vulnerabilities_updated") {
            setRefreshTrigger(prev => prev + 1);
          } else if (msg.event === "status_changed") {
            setRefreshTrigger(prev => prev + 1);
          } else if (msg.event === "inventory_updated") {
            setRefreshTrigger(prev => prev + 1);
          }
        } catch (err) {
          // Silent catch
        }
      };

      socket.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (socket) socket.close();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.get<DashboardStats>("/api/v1/dashboard/stats");
      setStats(data);
    } catch {
      // Mock defaults if request fails
    }
  };

  const triggerScan = async (cveId?: string) => {
    try {
      await api.post("/api/v1/scan/cmdb", { cve_id: cveId });
      // WS will update progress bar live
    } catch (err: any) {
      alert(err.message || "Failed to start scan");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-300 font-sans overflow-x-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#121214] border-r border-zinc-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center font-bold text-white tracking-wider">
              S
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block leading-none">SEC_ADVISOR</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">DOCKER CMDB</span>
            </div>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("vulnerabilities")}
              id="tab-vulnerabilities"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${activeTab === "vulnerabilities" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <ShieldAlert className="h-4 w-4" />
              Vulnerabilities
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              id="tab-inventory"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${activeTab === "inventory" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <Layers className="h-4 w-4" />
              Master Inventory
            </button>
            <button
              onClick={() => setActiveTab("eos-eol")}
              id="tab-eos-eol"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${activeTab === "eos-eol" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <Clock className="h-4 w-4" />
              EOS/EOL Tracker
            </button>
            <button
              onClick={() => setActiveTab("users")}
              id="tab-users"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer text-left ${activeTab === "users" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <UserCheck className="h-4 w-4" />
              Users & Access
            </button>
          </nav>
        </div>
        <div className="p-6 border-t border-zinc-800 bg-[#0c0c0e]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 uppercase">
                {username[0] || "U"}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white leading-none">{username}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mt-0.5">{userRole}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="rounded p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-850 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Right Stage Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Dynamic Metric Header */}
        <header className="h-20 border-b border-zinc-800 bg-[#09090b] flex items-center justify-between px-8 gap-6">
          {/* Stats Segment */}
          <div className="flex items-center gap-6 overflow-x-auto py-2 no-scrollbar">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Inventory</span>
              <span className="text-lg font-mono font-bold text-white" id="stat-inventory-count">{stats.inventory_count}</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 shrink-0"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Open Vulns</span>
              <span className="text-lg font-mono font-bold text-red-400 animate-pulse" id="stat-open-count">{stats.open_vulns_count}</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 shrink-0"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">High / Critical</span>
              <span className="text-lg font-mono font-bold text-orange-400" id="stat-high-count">{stats.high_critical_count}</span>
            </div>
            <div className="h-8 w-px bg-zinc-800 shrink-0"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total Matches</span>
              <span className="text-lg font-mono font-bold text-emerald-400" id="stat-total-count">{stats.total_matches_count}</span>
            </div>
          </div>

          {/* WS connection and mobile actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Dual-Engine AI Engine Switcher Toggle */}
            <div className="flex items-center gap-1 bg-[#121214] border border-zinc-800 rounded p-1 text-[10px] font-bold tracking-wider uppercase">
              <span className="px-2 text-zinc-500 text-[9px] font-mono tracking-widest hidden sm:inline">AI ENGINE:</span>
              <button
                onClick={() => toggleAiEngine("gemini")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${activeAiEngine === "gemini" ? "bg-emerald-600 text-white font-extrabold" : "text-zinc-550 hover:text-zinc-300 font-semibold"}`}
                title="Use Google Gemini 3.5 Flash Cloud API"
              >
                Gemini
              </button>
              <button
                onClick={() => toggleAiEngine("ollama")}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${activeAiEngine === "ollama" ? "bg-amber-500 text-zinc-950 font-extrabold" : "text-zinc-550 hover:text-zinc-300 font-semibold"}`}
                title="Use Local Ollama Gemma/Llama models"
              >
                Ollama
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded bg-emerald-600/10 border border-emerald-500/20 px-2 py-1 text-[9px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              WS Live Connected
            </span>
            
            {/* Mobile/small viewport sign out button */}
            <button
              onClick={onLogout}
              className="md:hidden rounded p-2 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content body - Grid container layout */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Mobile Tab Selectors (Hidden on desktop) */}
          <div className="md:hidden flex border-b border-zinc-800 mb-6 overflow-x-auto no-scrollbar gap-2" id="view-tabs">
            <button
              onClick={() => setActiveTab("vulnerabilities")}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap px-2 ${activeTab === "vulnerabilities" ? "border-b-2 border-emerald-500 text-white" : "text-zinc-500"}`}
              id="tab-vulnerabilities-mobile"
            >
              Vulnerabilities
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap px-2 ${activeTab === "inventory" ? "border-b-2 border-emerald-500 text-white" : "text-zinc-500"}`}
              id="tab-inventory-mobile"
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveTab("eos-eol")}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap px-2 ${activeTab === "eos-eol" ? "border-b-2 border-emerald-500 text-white" : "text-zinc-500"}`}
              id="tab-eos-eol-mobile"
            >
              EOS/EOL
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 pb-3 text-xs font-bold tracking-wider uppercase transition-colors whitespace-nowrap px-2 ${activeTab === "users" ? "border-b-2 border-emerald-500 text-white" : "text-zinc-500"}`}
              id="tab-users-mobile"
            >
              Users
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Main Interactive Grid */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <ZeroDayAlertPanel
                userRole={userRole}
                refreshTrigger={refreshTrigger}
                onPatched={() => setRefreshTrigger(prev => prev + 1)}
              />

              {activeTab === "vulnerabilities" ? (
                <VulnerabilityGrid
                  userRole={userRole}
                  refreshTrigger={refreshTrigger}
                  onStatusChanged={() => setRefreshTrigger(prev => prev + 1)}
                />
              ) : activeTab === "inventory" ? (
                <InventoryGrid
                  userRole={userRole}
                  refreshTrigger={refreshTrigger}
                />
              ) : activeTab === "eos-eol" ? (
                <EosEolTrackerGrid
                  userRole={userRole}
                  refreshTrigger={refreshTrigger}
                  onEosUpdated={() => setRefreshTrigger(prev => prev + 1)}
                />
              ) : (
                <UserManagementPanel userRole={userRole} />
              )}
            </div>

            {/* Config Panels and Scan Controllers */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <CmdbScanPanel
                userRole={userRole}
                scanProgress={scanProgress}
                onScanTriggered={triggerScan}
                onSettingsChanged={() => setRefreshTrigger(prev => prev + 1)}
              />
              <CveSourcesPanel
                userRole={userRole}
                onSourcesChanged={() => setRefreshTrigger(prev => prev + 1)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

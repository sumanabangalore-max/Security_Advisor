import { useState, useEffect } from "react";
import { 
  LogOut, ShieldAlert, Layers, Clock, Settings, MessageSquare, 
  Coins, Building2, LayoutDashboard, Cloud, ShieldCheck, Flame, ChevronRight,
  ChevronDown, Users, Wrench, Key, Mail, Database, Package
} from "lucide-react";
import { api } from "../api";
import { DashboardStats, ScanProgressState, LdapConfig, LoggingConfig } from "../types";
import CmdbScanPanel from "./CmdbScanPanel";
import CveSourcesPanel from "./CveSourcesPanel";
import VulnerabilityGrid from "./VulnerabilityGrid";
import InventoryGrid from "./InventoryGrid";
import EosEolTrackerGrid from "./EosEolTrackerGrid";
import PatchTrackerGrid from "./PatchTrackerGrid";
import ConfigurationPanel from "./ConfigurationPanel";
import ZeroDayAlertPanel from "./ZeroDayAlertPanel";
import NotificationBell, { NotificationItem } from "./NotificationBell";
import AiChatbotPanel from "./AiChatbotPanel";
import TokenAnalyticsPanel from "./TokenAnalyticsPanel";
import AdministrationPanel, { AdminSubTab } from "./AdministrationPanel";
import ExecutiveOverviewDashboard from "./ExecutiveOverviewDashboard";
import LdapConfigPanel from "./LdapConfigPanel";
import ExternalLoggingPanel from "./ExternalLoggingPanel";
import DeployAipatchModal from "./DeployAipatchModal";
import { Vulnerability, UserRole } from "../types";

interface DashboardProps {
  username: string;
  userRole: UserRole;
  onLogout: () => void;
}

export type ActiveTabType = 
  | "overview" 
  | "vulnerabilities" 
  | "zero-day" 
  | "inventory" 
  | "ldap-config" 
  | "external-logging" 
  | "eos-eol" 
  | "patch-tracker"
  | "chatbot" 
  | "token-analytics" 
  | "config" 
  | "administration";

export default function Dashboard({ username, userRole, onLogout }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    inventory_count: 0,
    open_vulns_count: 0,
    high_critical_count: 0,
    total_matches_count: 0,
    zero_day_count: 0
  });

  const [ldapConfig, setLdapConfig] = useState<LdapConfig | null>(null);
  const [loggingConfig, setLoggingConfig] = useState<LoggingConfig | null>(null);

  // Default to Overview (Executive Landing Dashboard)
  const [activeTab, setActiveTab] = useState<ActiveTabType>("overview");
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>("users");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeAiEngine, setActiveAiEngine] = useState(() => {
    return localStorage.getItem("active_ai_engine") || "platform";
  });

  // AIPatch Deploy Modal state
  const [deployModalVuln, setDeployModalVuln] = useState<Vulnerability | null>(null);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  const handleOpenDeployModal = (vuln: Vulnerability) => {
    setDeployModalVuln(vuln);
    setDeployModalOpen(true);
  };

  const isTabAllowedForRole = (tabId: string, role: UserRole): boolean => {
    if (role === "admin") return true;
    if (role === "patch_manager") return ["patch-tracker", "inventory", "chatbot"].includes(tabId);
    if (role === "eos_manager") return ["eos-eol", "inventory", "chatbot"].includes(tabId);
    if (role === "vuln_manager") return ["vulnerabilities", "zero-day", "overview", "inventory", "chatbot"].includes(tabId);
    if (role === "analyst") return tabId !== "administration";
    if (role === "viewer") return ["overview", "vulnerabilities", "inventory", "eos-eol", "patch-tracker"].includes(tabId);
    return false;
  };

  // Handle Legacy tab redirects to Administration master panel and role-based page enforcement
  useEffect(() => {
    if ((activeTab as string) === "ldap-config") {
      setActiveTab("administration");
      setAdminSubTab("ldap");
      return;
    } else if ((activeTab as string) === "external-logging") {
      setActiveTab("administration");
      setAdminSubTab("siem");
      return;
    } else if ((activeTab as string) === "config") {
      setActiveTab("administration");
      setAdminSubTab("smtp");
      return;
    }

    // Auto-switch to first authorized page if current page is restricted for active role
    if (!isTabAllowedForRole(activeTab, userRole)) {
      if (userRole === "patch_manager") setActiveTab("patch-tracker");
      else if (userRole === "eos_manager") setActiveTab("eos-eol");
      else if (userRole === "vuln_manager") setActiveTab("vulnerabilities");
      else setActiveTab("overview");
    }
  }, [activeTab, userRole]);

  // Notification Bell State
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem("sec_advisor_notifications");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      {
        id: "init-1",
        title: "SecAdvisor WS Live Connected",
        message: "Listening to real-time CMDB inventory changes & vulnerability threat updates.",
        timestamp: new Date().toISOString(),
        read: false,
        event: "status_changed"
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem("sec_advisor_notifications", JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (title: string, message: string, eventType?: string) => {
    const newItem: NotificationItem = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      event: eventType
    };
    setNotifications(prev => [newItem, ...prev.slice(0, 49)]);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const toggleAiEngine = (engine: "platform" | "gemini") => {
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
    fetchSystemConfigs();
  }, [refreshTrigger]);

  const fetchSystemConfigs = async () => {
    try {
      const ldapData = await api.get<LdapConfig>("/api/v1/admin/ldap/config");
      setLdapConfig(ldapData);
    } catch { /* ignore */ }
    try {
      const loggingData = await api.get<LoggingConfig>("/api/v1/admin/logging/config");
      setLoggingConfig(loggingData);
    } catch { /* ignore */ }
  };

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
          
          if (msg.title && msg.message) {
            addNotification(msg.title, msg.message, msg.event);
          }

          if (msg.event === "scan_progress") {
            setScanProgress({
              is_scanning: msg.is_scanning,
              percentage: msg.percentage,
              current_cve: msg.current_cve
            });
            if (!msg.is_scanning && msg.percentage === 100) {
              setRefreshTrigger(prev => prev + 1);
              addNotification("Scan Completed", "CMDB vulnerability scan completed.", "scan_progress");
            }
          } else if (
            msg.event === "vulnerabilities_updated" ||
            msg.event === "status_changed" ||
            msg.event === "inventory_updated" ||
            msg.event === "zeroday_patched"
          ) {
            setRefreshTrigger(prev => prev + 1);
          }
        } catch (err) {
          // Silent catch
        }
      };

      socket.onclose = () => {
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
      // Mock defaults
    }
  };

  const triggerScan = async (cveId?: string) => {
    try {
      await api.post("/api/v1/scan/cmdb", { cve_id: cveId });
    } catch (err: any) {
      alert(err.message || "Failed to start scan");
    }
  };

  const navItems = [
    { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
    { id: "vulnerabilities", label: "Vulnerabilities", icon: ShieldAlert },
    { id: "zero-day", label: "Zero-Day Radar", icon: Flame, badge: stats.zero_day_count || 1 },
    { id: "inventory", label: "Master Inventory", icon: Layers },
    { id: "eos-eol", label: "EOS/EOL Tracker", icon: Clock },
    { id: "patch-tracker", label: "Patch Tracker", icon: Package },
    { id: "chatbot", label: "AI Security Chat", icon: MessageSquare, highlight: "AI" },
    { id: "token-analytics", label: "Token Analytics", icon: Coins },
    { 
      id: "administration", 
      label: "Administration", 
      icon: ShieldCheck,
      hasDropdown: true,
      subItems: [
        { id: "users", label: "User Directory & Roles", icon: Users },
        { id: "ldap", label: "Active Directory LDAP", icon: Building2 },
        { id: "db-config", label: "DB Configuration", icon: Database },
        { id: "siem", label: "SIEM & External Logging", icon: Cloud },
        { id: "smtp", label: "SMTP Config", icon: Mail },
        { id: "cve-sources", label: "CVE Source Config", icon: Database },
        { id: "ai-platform", label: "AI Platform & API Keys", icon: Key },
        { id: "system-patching", label: "System Patching & Upgrades", icon: Wrench },
      ]
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800 font-sans overflow-x-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 hidden md:flex shadow-xs">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-lg tracking-wider shadow-xs">
              S
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-tight">SecAdvisor</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enterprise Security</span>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              if (!isTabAllowedForRole(item.id, userRole)) return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              if (item.hasDropdown) {
                return (
                  <div 
                    key={item.id} 
                    className="relative group"
                    onMouseEnter={() => setAdminMenuOpen(true)}
                    onMouseLeave={() => setAdminMenuOpen(false)}
                  >
                    <button
                      onClick={() => {
                        setActiveTab("administration");
                        setAdminMenuOpen(prev => !prev);
                      }}
                      id={`tab-${item.id}`}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                        isActive 
                          ? "bg-indigo-600 text-white shadow-xs" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                        <span className="truncate">{item.label}</span>
                      </span>

                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        adminMenuOpen || isActive ? "rotate-180 text-white" : "text-slate-400"
                      }`} />
                    </button>

                    {/* Hover Dropdown Sub-menu */}
                    {(adminMenuOpen || isActive) && (
                      <div className="mt-1 ml-3 pl-3 border-l-2 border-indigo-100 space-y-1 py-1 animate-in fade-in-50 duration-150">
                        {item.subItems?.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = isActive && adminSubTab === sub.id;

                          return (
                            <button
                              key={sub.id}
                              onClick={() => {
                                setActiveTab("administration");
                                setAdminSubTab(sub.id as AdminSubTab);
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-left ${
                                isSubActive
                                  ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                                  : "text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
                              }`}
                            >
                              <SubIcon className={`h-3.5 w-3.5 ${isSubActive ? "text-indigo-600" : "text-slate-400"}`} />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as ActiveTabType)}
                  id={`tab-${item.id}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                    isActive 
                      ? "bg-indigo-600 text-white shadow-xs" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`} />
                    <span className="truncate">{item.label}</span>
                  </span>

                  {item.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? "bg-red-500 text-white" : "bg-red-100 text-red-700 border border-red-200"
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {item.highlight && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono ${
                      isActive ? "bg-indigo-700 text-white" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                    }`}>
                      {item.highlight}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-extrabold text-indigo-700 uppercase">
                {username[0] || "U"}
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900 leading-none">{username}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">{userRole}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 gap-6 shadow-xs">
          {/* Stats Summary Bar */}
          <div className="flex items-center gap-6 overflow-x-auto py-1 no-scrollbar">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CMDB Assets:</span>
              <span className="text-sm font-bold font-mono text-slate-900" id="stat-inventory-count">{stats.inventory_count}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Vulns:</span>
              <span className="text-sm font-bold font-mono text-red-600" id="stat-open-count">{stats.open_vulns_count}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High/Critical:</span>
              <span className="text-sm font-bold font-mono text-amber-600" id="stat-high-count">{stats.high_critical_count}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 shrink-0"></div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zero-Day:</span>
              <span className="text-sm font-bold font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200" id="stat-zeroday-count">{stats.zero_day_count || 1}</span>
            </div>
          </div>

          {/* WS Connection, AI Model Selector, Notification Bell */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Dual-Engine AI Model Selector Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1 text-[10px] font-bold tracking-wider uppercase">
              <span className="px-1.5 text-slate-500 text-[9px] font-mono tracking-widest hidden sm:inline">AI ENGINE:</span>
              <button
                onClick={() => toggleAiEngine("platform")}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeAiEngine === "platform" ? "bg-emerald-600 text-white font-extrabold shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Use GovTech AI Platform API (api.ai.tech.gov.sg)"
              >
                GovTech AI
              </button>
              <button
                onClick={() => toggleAiEngine("gemini")}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  activeAiEngine === "gemini" ? "bg-indigo-600 text-white font-extrabold shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Use Google Gemini 3.6 Flash API"
              >
                Gemini 3.6 Flash
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              WS Connected
            </span>

            {/* Live Notification Bell Dropdown */}
            <NotificationBell
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onClearAll={handleClearAllNotifications}
            />

            {/* Mobile sign out button */}
            <button
              onClick={onLogout}
              className="md:hidden rounded-lg p-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Main Workspace Stage */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Mobile Tabs */}
          <div className="md:hidden flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar gap-2" id="view-tabs">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTabType)}
                className={`pb-2.5 text-xs font-bold whitespace-nowrap px-3 border-b-2 transition-colors ${
                  activeTab === item.id 
                    ? "border-indigo-600 text-indigo-600" 
                    : "border-transparent text-slate-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Active Tab View Rendering */}
          {activeTab === "overview" ? (
            <ExecutiveOverviewDashboard
              stats={stats}
              scanProgress={scanProgress}
              onNavigateTab={(t, sub) => {
                setActiveTab(t as ActiveTabType);
                if (sub) setAdminSubTab(sub as AdminSubTab);
              }}
              onStartScan={triggerScan}
              ldapConfig={ldapConfig}
              loggingConfig={loggingConfig}
            />
          ) : activeTab === "vulnerabilities" ? (
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <VulnerabilityGrid
                  userRole={userRole}
                  refreshTrigger={refreshTrigger}
                  onStatusChanged={() => setRefreshTrigger(prev => prev + 1)}
                  excludeZeroDays={true}
                  onDeployAgent={(vuln) => handleOpenDeployModal(vuln)}
                />
              </div>
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
                  hideToggleButtons={true}
                />
              </div>
            </div>
          ) : activeTab === "zero-day" ? (
            <div className="space-y-6">
              <ZeroDayAlertPanel
                userRole={userRole}
                refreshTrigger={refreshTrigger}
                onPatched={() => setRefreshTrigger(prev => prev + 1)}
                onDeployAgent={(vuln) => handleOpenDeployModal(vuln)}
              />
            </div>
          ) : activeTab === "inventory" ? (
            <InventoryGrid
              userRole={userRole}
              refreshTrigger={refreshTrigger}
              onInventoryUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          ) : activeTab === "eos-eol" ? (
            <EosEolTrackerGrid
              userRole={userRole}
              refreshTrigger={refreshTrigger}
              onEosUpdated={() => setRefreshTrigger(prev => prev + 1)}
            />
          ) : activeTab === "patch-tracker" ? (
            <PatchTrackerGrid
              userRole={userRole}
              refreshTrigger={refreshTrigger}
            />
          ) : activeTab === "chatbot" ? (
            <AiChatbotPanel userRole={userRole} />
          ) : activeTab === "token-analytics" ? (
            <TokenAnalyticsPanel />
          ) : activeTab === "administration" ? (
            <AdministrationPanel 
              userRole={userRole} 
              activeSubTab={adminSubTab}
              onSubTabChange={(sub) => setAdminSubTab(sub)}
            />
          ) : null}
        </div>
      </div>

      {/* AIPatch Remote CI Deploy Modal */}
      <DeployAipatchModal
        vulnerability={deployModalVuln}
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        userRole={userRole}
      />
    </div>
  );
}


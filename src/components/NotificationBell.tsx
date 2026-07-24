import { useState, useRef, useEffect } from "react";
import { Bell, Check, Trash2, ShieldAlert, Layers, Clock, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  event?: string;
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

export default function NotificationBell({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getEventIcon = (event?: string) => {
    switch (event) {
      case "vulnerabilities_updated":
      case "status_changed":
      case "zeroday_patched":
        return <ShieldAlert className="h-4 w-4 text-red-400" />;
      case "inventory_updated":
        return <Layers className="h-4 w-4 text-blue-400" />;
      case "eos_updated":
        return <Clock className="h-4 w-4 text-amber-400" />;
      case "scan_progress":
        return <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />;
      case "analytics_updated":
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      
      if (diffSecs < 10) return "Just now";
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded border border-zinc-800 bg-[#121214] p-2 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all cursor-pointer focus:outline-none"
        title="Notifications"
        id="notification-bell-btn"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-zinc-800 bg-[#121214] shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-[#0c0c0e]">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Notifications
              </h4>
              {unreadCount > 0 && (
                <span className="rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <Check className="h-3 w-3" />
                  Mark Read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear all"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 font-mono space-y-1">
                <p>No new notifications</p>
                <p className="text-[10px] text-zinc-600">Events from scans, status updates & inventory will appear here live</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onMarkAsRead(item.id)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-zinc-900/50 ${
                    !item.read ? "bg-emerald-500/[0.03] border-l-2 border-l-emerald-500" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0 rounded bg-zinc-900 border border-zinc-800 p-1.5">
                    {getEventIcon(item.event)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${!item.read ? "text-white" : "text-zinc-300"}`}>
                        {item.title}
                      </p>
                      <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug break-words">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

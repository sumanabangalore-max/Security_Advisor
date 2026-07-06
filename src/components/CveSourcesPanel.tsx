import { useState, useEffect } from "react";
import { Database, Check } from "lucide-react";
import { api } from "../api";
import { CveSourcesConfig } from "../types";

interface CveSourcesPanelProps {
  userRole: "admin" | "analyst" | "viewer";
  onSourcesChanged: () => void;
}

export default function CveSourcesPanel({ userRole, onSourcesChanged }: CveSourcesPanelProps) {
  const [sources, setSources] = useState<CveSourcesConfig>({
    nvd_enabled: true,
    microsoft_enabled: true,
    ubuntu_enabled: true,
    cisco_enabled: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canEdit = userRole === "admin" || userRole === "analyst";

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const data = await api.get<CveSourcesConfig>("/api/v1/cve-sources");
      setSources(data);
    } catch (err) {
      setError("Failed to fetch CVE data sources");
    }
  };

  const handleToggle = async (key: keyof CveSourcesConfig) => {
    if (!canEdit || loading) return;
    setLoading(true);
    const updated = { ...sources, [key]: !sources[key] };
    try {
      setSources(updated);
      await api.patch("/api/v1/cve-sources", updated);
      onSourcesChanged();
    } catch (err) {
      setError("Failed to save data source state");
    } finally {
      setLoading(false);
    }
  };

  const feeds = [
    {
      id: "nvd",
      key: "nvd_enabled" as keyof CveSourcesConfig,
      name: "NIST NVD API v2.0",
      description: "Direct connection to the National Vulnerability Database. Syncs comprehensive CVSS mappings and CPE definitions.",
    },
    {
      id: "microsoft",
      key: "microsoft_enabled" as keyof CveSourcesConfig,
      name: "Microsoft Security Guide",
      description: "Microsoft Active Directory, Outlook, and Windows Server patch definitions and security advisories.",
    },
    {
      id: "ubuntu",
      key: "ubuntu_enabled" as keyof CveSourcesConfig,
      name: "Ubuntu Security Bulletins",
      description: "USN advisories tracking Linux kernel vulnerabilities, glibc exploits, and deb package patches.",
    },
    {
      id: "cisco",
      key: "cisco_enabled" as keyof CveSourcesConfig,
      name: "Cisco Security Advisories",
      description: "Appliance patch streams for Cisco IOS XE software, routers, and enterprise switch firmware.",
    },
  ];

  return (
    <div className="rounded-lg border border-zinc-800 bg-[#121214] p-5 space-y-4 shadow-md" id="cve-sources-panel">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded bg-emerald-600/10 p-1.5 text-emerald-400">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">CVE Data Sources</h3>
            <p className="text-[11px] text-zinc-500">Manage connections to external vulnerability databases</p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

      <div className="space-y-3">
        {feeds.map((feed) => {
          const isEnabled = !!sources[feed.key];
          return (
            <div key={feed.id} className="rounded border border-zinc-850 bg-zinc-900/60 p-4 flex items-center justify-between gap-4 transition-colors hover:bg-zinc-900">
              <div className="space-y-1 pr-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-white">{feed.name}</span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${isEnabled ? "bg-emerald-600/15 text-emerald-400 border border-emerald-600/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700/50"}`}>
                    {isEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{feed.description}</p>
              </div>

              <div className="shrink-0">
                {canEdit ? (
                  <button
                    id={`${feed.id}-source-toggle-btn`}
                    onClick={() => handleToggle(feed.key)}
                    disabled={loading}
                    className={`rounded px-2.5 py-1.5 text-[9px] font-bold tracking-wider transition-all cursor-pointer select-none border ${isEnabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"}`}
                  >
                    {isEnabled ? "DEACTIVATE" : "ACTIVATE"}
                  </button>
                ) : (
                  <span className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">Protected</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

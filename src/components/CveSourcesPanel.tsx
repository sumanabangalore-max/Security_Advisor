import { useState, useEffect } from "react";
import { Database, Check, ExternalLink } from "lucide-react";
import { api } from "../api";
import { CveSourcesConfig, UserRole } from "../types";

interface CveSourcesPanelProps {
  userRole: UserRole;
  onSourcesChanged: () => void;
  hideToggleButtons?: boolean;
}

export default function CveSourcesPanel({ userRole, onSourcesChanged, hideToggleButtons = false }: CveSourcesPanelProps) {
  const [sources, setSources] = useState<CveSourcesConfig>({
    nvd_enabled: true,
    cisa_kev_enabled: true,
    epss_enabled: true,
    microsoft_enabled: true,
    ubuntu_enabled: true,
    cisco_enabled: true,
    aruba_enabled: true,
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
      id: "cisa_kev",
      key: "cisa_kev_enabled" as keyof CveSourcesConfig,
      name: "CISA Known Exploited Vulnerabilities (KEV)",
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      description: "Direct API feed to the CISA Known Exploited Vulnerabilities Catalog (cisa.gov/known-exploited-vulnerabilities-catalog). Scans and correlates vulnerabilities impacting your inventory with confirmed in-the-wild exploitation and mandatory remediation due dates.",
    },
    {
      id: "epss",
      key: "epss_enabled" as keyof CveSourcesConfig,
      name: "FIRST.org EPSS Scoring API",
      url: "https://www.first.org/epss/",
      description: "Direct API integration with FIRST.org Exploit Prediction Scoring System (first.org/epss). Evaluates 30-day threat exploitation probability scores and percentile rankings for every identified CVE.",
    },
    {
      id: "nvd",
      key: "nvd_enabled" as keyof CveSourcesConfig,
      name: "NIST NVD API v2.0",
      url: "https://nvd.nist.gov",
      description: "Direct connection to the National Vulnerability Database. Syncs comprehensive CVSS v3.1 mappings, CWE classifications, and CPE definitions.",
    },
    {
      id: "microsoft",
      key: "microsoft_enabled" as keyof CveSourcesConfig,
      name: "Microsoft Security Guide",
      url: "https://msrc.microsoft.com",
      description: "Microsoft Active Directory, Outlook, and Windows Server patch definitions and security advisories.",
    },
    {
      id: "ubuntu",
      key: "ubuntu_enabled" as keyof CveSourcesConfig,
      name: "Ubuntu Security Notices & Package Updates",
      url: "https://ubuntu.com/security/notices",
      description: "Monitors Ubuntu Security Notices (ubuntu.com/security/notices) and package release streams (ubuntuupdates.org) for USN advisories and deb patch availability.",
    },
    {
      id: "cisco",
      key: "cisco_enabled" as keyof CveSourcesConfig,
      name: "Cisco Security Advisories",
      url: "https://sec.cloudapps.cisco.com/security/center",
      description: "Appliance patch streams for Cisco IOS XE software, routers, and enterprise switch firmware.",
    },
    {
      id: "aruba",
      key: "aruba_enabled" as keyof CveSourcesConfig,
      name: "HPE Aruba Security Advisories",
      url: "https://www.arubanetworks.com/support",
      description: "Appliance tracking feeds for HPE Aruba Switch CX 6300 firmware, controllers, and wireless access points.",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs" id="cve-sources-panel">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">CVE Data Sources</h3>
            <p className="text-[11px] text-slate-500">Manage connections to external vulnerability databases</p>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

      <div className="space-y-3">
        {feeds.map((feed) => {
          const isEnabled = !!sources[feed.key];
          return (
            <div key={feed.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between gap-4 transition-colors hover:bg-slate-50">
              <div className="space-y-1 pr-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900">{feed.name}</span>
                  {feed.url && (
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-mono"
                      title={`Open ${feed.url}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      API / Catalog
                    </a>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                    {isEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{feed.description}</p>
              </div>

              {!hideToggleButtons && (
                <div className="shrink-0">
                  {canEdit ? (
                    <button
                      id={`${feed.id}-source-toggle-btn`}
                      onClick={() => handleToggle(feed.key)}
                      disabled={loading}
                      className={`rounded-xl px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all cursor-pointer select-none border ${isEnabled ? "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"}`}
                    >
                      {isEnabled ? "DEACTIVATE" : "ACTIVATE"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Protected</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

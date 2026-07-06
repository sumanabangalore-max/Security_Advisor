export interface User {
  username: string;
  role: "admin" | "analyst" | "viewer";
}

export interface InventoryItem {
  id: number;
  software_name: string;
  version: string;
  environment: string;
  created_at: string;
  updated_at: string;
  hostname?: string;
  ip_address?: string;
  owner?: string;
  criticality?: string;
  cpe_uri?: string;
}

export interface Vulnerability {
  id: number;
  cve_id: string;
  software_id?: number;
  software_name: string;
  version: string;
  environment: string;
  summary: string;
  cvss_score: number | null;
  status: "Open" | "False Positive" | "Mitigated";
  assigned_engineer: string | null;
  published_date: string;
  detected_at: string;
  age_days: number;
  reremediation_steps?: string;
  remediation_steps?: string;
  impact_analysis?: string;
  mitigation?: string;
  remediation_links?: string[];
  source?: string;
  affected_cpe?: string;
  is_zero_day?: boolean;
  hostname?: string;
  ip_address?: string;
  owner?: string;
}

export interface CveSourcesConfig {
  nvd_enabled: boolean;
  microsoft_enabled: boolean;
  ubuntu_enabled: boolean;
  cisco_enabled: boolean;
}

export interface ScanSettingsConfig {
  auto_scan: boolean;
  scan_window_days: number;
}

export interface ScanProgressState {
  is_scanning: boolean;
  percentage: number;
  current_cve: string;
}

export interface DashboardStats {
  inventory_count: number;
  open_vulns_count: number;
  high_critical_count: number;
  total_matches_count: number;
  zero_day_count: number;
}

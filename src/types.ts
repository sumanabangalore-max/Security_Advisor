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
  cvss_vector?: string;
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
  aruba_enabled: boolean;
}

export interface EosEolRecord {
  id: number;
  software_name: string;
  version: string;
  environment: string;
  status: "Supported" | "End of Support" | "End of Life";
  eos_date: string;
  eol_date: string;
  last_check_date: string;
  source_url: string;
  notes: string;
  source_checking?: string;
  owner?: string;
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

export interface AdminComponent {
  id: string;
  name: string;
  category: string;
  current_version: string;
  latest_version: string;
  license: string;
  security_status: string;
  vulnerability_fix: string;
  cve_ref: string;
  compatibility_score: string;
  breaking_changes: string;
}

export interface AssessmentResult {
  compatible_count: number;
  breaking_changes_detected: number;
  security_fixes_count: number;
  overall_compatibility: string;
  logs: string[];
}

export interface AdminUpgradeState {
  system_version: string;
  status: "idle" | "assessed" | "remediated" | "rolled_back";
  last_assessment_at: string | null;
  last_remediation_at: string | null;
  last_rollback_at: string | null;
  assessment_results: AssessmentResult | null;
  snapshot_version: string | null;
  components: AdminComponent[];
}

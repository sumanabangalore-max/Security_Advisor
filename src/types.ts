export interface JumpHostConfig {
  environment: string;
  host: string;
  ip_address: string;
  port: number;
  user: string;
  auth_method: string;
  remote_ci_cmd: string;
  status: string;
  target_vms_count: number;
}

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

export interface PreprodStageDetail {
  status: "COMPLETED" | "PENDING";
  completed_at?: string | null;
  verified_by?: string | null;
  ci_id?: string;
}

export interface PreprodCveGate {
  cve_id: string;
  software_name: string;
  stages: {
    DEV: PreprodStageDetail;
    SIT: PreprodStageDetail;
    UAT: PreprodStageDetail;
    ORT: PreprodStageDetail;
  };
  all_preprod_completed: boolean;
}

export interface Vulnerability {
  id: number;
  cve_id: string;
  software_id?: number;
  software_name: string;
  version: string;
  fixed_version?: string;
  fixed_image?: string;
  recommended_fix?: string;
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

export interface LdapConfig {
  enabled: boolean;
  server_host: string;
  port: number;
  security_protocol: "none" | "starttls" | "ldaps";
  base_dn: string;
  bind_dn: string;
  bind_password?: string;
  user_filter: string;
  group_filter: string;
  attr_username: string;
  attr_email: string;
  attr_name: string;
  attr_group: string;
  group_role_mapping: {
    admin_group: string;
    analyst_group: string;
    viewer_group: string;
  };
  last_synced_at?: string;
  status?: "connected" | "disconnected" | "error";
}

export interface LoggingConfig {
  enabled: boolean;
  active_provider: "aws" | "azure" | "syslog";
  aws: {
    region: string;
    log_group: string;
    log_stream: string;
    access_key_id: string;
    secret_access_key: string;
  };
  azure: {
    workspace_id: string;
    shared_key: string;
    log_type: string;
  };
  syslog: {
    host: string;
    port: number;
    protocol: "udp" | "tcp" | "tls";
    format: "cef" | "leef" | "rfc5424" | "json";
    facility: string;
    min_severity: "info" | "warning" | "error" | "critical";
  };
  last_event_sent_at?: string;
  events_forwarded_count?: number;
}

export interface ForwardedAuditLog {
  id: string;
  timestamp: string;
  provider: "aws" | "azure" | "syslog";
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  event_type: string;
  source_ip: string;
  user: string;
  message: string;
  raw_payload: string;
  status: "DELIVERED" | "QUEUED" | "FAILED";
}


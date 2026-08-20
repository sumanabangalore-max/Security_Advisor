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

export type UserRole = "admin" | "analyst" | "viewer" | "patch_manager" | "eos_manager" | "vuln_manager";

export interface User {
  username: string;
  role: UserRole;
}

export interface DatabaseConfig {
  provider: "azure_paas" | "aws_rds" | "custom_postgres" | "custom_mysql";
  db_type: "postgres" | "mysql" | "mssql";
  host: string;
  port: number;
  database_name: string;
  username: string;
  password?: string;
  ssl_mode: "require" | "verify-full" | "prefer" | "disable";
  max_connections: number;
  connection_string?: string;
  status: "connected" | "disconnected" | "testing" | "error";
  last_tested_at?: string;
  tables_synced?: number;
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
  pic_email?: string;
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
  pic_email?: string;
  criticality?: string;
  // CISA KEV (Known Exploited Vulnerabilities) Integration
  cisa_kev?: boolean;
  cisa_kev_flag?: boolean;
  cisa_kev_date_added?: string;
  cisa_kev_due_date?: string;
  cisa_kev_action?: string;
  cisa_kev_ransomware?: string;
  cisa_kev_notes?: string;
  // FIRST.org EPSS (Exploit Prediction Scoring System) Integration
  epss_score?: number;
  epss_percentile?: number;
  epss_date?: string;
}

export interface CveSourcesConfig {
  nvd_enabled: boolean;
  cisa_kev_enabled: boolean;
  epss_enabled: boolean;
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
  pic_email?: string;
}

export interface UpgradeRoadmap {
  same_version_target: string;
  market_target: string;
  upgrade_strategy: "In-Place Cumulative Rollup" | "Major Release Upgrade" | "Container Image Rebase" | "Zero-Downtime Migration";
  steps: string[];
}

export interface PatchItem {
  id: number;
  software_name: string;
  installed_version: string;
  latest_patch_version: string;
  latest_same_version_patch: string;
  latest_market_version: string;
  same_version_patch_status: "Up to Date" | "Patch Available" | "Branch Supported";
  patch_release_date: string;
  installed_version_release_date?: string;
  same_version_patch_release_date?: string;
  market_version_release_date?: string;
  patch_severity: "Critical" | "High" | "Medium" | "Low" | "Up to Date";
  is_up_to_date: boolean;
  hostname: string;
  environment: string;
  owner: string;
  pic_email?: string;
  criticality: string;
  cve_fixes: string[];
  source_url: string;
  secondary_source_url?: string;
  release_notes_summary: string;
  recommended_action: string;
  upgrade_roadmap?: UpgradeRoadmap;
  last_scanned_at: string;
}

export interface ShakedownAssertion {
  check: string;
  passed: boolean;
  value?: string;
  expected?: string;
}

export interface ShakedownTestCase {
  id: string;
  category: "Core APIs" | "Token & Auth" | "Vulnerabilities" | "Zero-Day Tracking" | "EOS / EOL Lifecycle" | "Patch Tracker" | "External Integrations" | "AI Engine";
  name: string;
  description: string;
  status: "PASSED" | "WARNING" | "FAILED" | "PENDING";
  duration_ms: number;
  details: string;
  assertions: ShakedownAssertion[];
  timestamp: string;
}

export interface ShakedownSuiteResult {
  suite_id: string;
  execution_timestamp: string;
  system_version: string;
  environment: string;
  total_tests: number;
  passed_tests: number;
  warning_tests: number;
  failed_tests: number;
  pass_rate_percent: number;
  total_duration_ms: number;
  status: "ALL_SYSTEMS_OPERATIONAL" | "WARNINGS_DETECTED" | "DEGRADED";
  test_cases: ShakedownTestCase[];
  audit_hash: string;
}

export interface PatchScheduleConfig {
  auto_scan: boolean;
  frequency: "daily" | "weekly" | "monthly";
  scan_time: string;
  last_run_at: string;
  next_run_at: string;
  notify_on_critical: boolean;
  last_scanned_at?: string;
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


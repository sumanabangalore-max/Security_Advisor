import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import * as xlsx from "xlsx";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Load or create files in inventory and root
const INVENTORY_DIR = path.join(process.cwd(), "inventory");
const INVENTORY_PATH = path.join(INVENTORY_DIR, "inventory.json");
const CVE_SOURCES_PATH = path.join(process.cwd(), "cve_sources.json");
const SCAN_SETTINGS_PATH = path.join(process.cwd(), "scan_settings.json");
const USERS_PATH = path.join(process.cwd(), "users.json");

// Default files setup
if (!fs.existsSync(INVENTORY_DIR)) {
  fs.mkdirSync(INVENTORY_DIR, { recursive: true });
}
if (!fs.existsSync(INVENTORY_PATH)) {
  fs.writeFileSync(INVENTORY_PATH, JSON.stringify([
    {
      "software_name": "Apache HTTP Server",
      "version": "2.4.48",
      "environment": "Production",
      "hostname": "web-srv-01.internal",
      "ip_address": "10.140.0.12",
      "owner": "Web-Ops Team",
      "criticality": "High",
      "cpe_uri": "cpe:2.3:a:apache:http_server:2.4.48:*:*:*:*:*:*:*"
    },
    {
      "software_name": "OpenSSL",
      "version": "1.1.1k",
      "environment": "Production",
      "hostname": "auth-srv-04.internal",
      "ip_address": "10.140.0.22",
      "owner": "Security Team",
      "criticality": "Critical",
      "cpe_uri": "cpe:2.3:a:openssl:openssl:1.1.1k:*:*:*:*:*:*:*"
    },
    {
      "software_name": "nginx",
      "version": "1.18.0",
      "environment": "Staging",
      "hostname": "lb-stage-01.internal",
      "ip_address": "10.150.1.5",
      "owner": "DevOps Team",
      "criticality": "Medium",
      "cpe_uri": "cpe:2.3:a:nginx:nginx:1.18.0:*:*:*:*:*:*:*"
    },
    {
      "software_name": "PostgreSQL",
      "version": "12.5",
      "environment": "Production",
      "hostname": "db-prod-01.internal",
      "ip_address": "10.140.0.50",
      "owner": "Database Admins",
      "criticality": "Critical",
      "cpe_uri": "cpe:2.3:a:postgresql:postgresql:12.5:*:*:*:*:*:*:*"
    },
    {
      "software_name": "Node.js",
      "version": "14.17.0",
      "environment": "Development",
      "hostname": "dev-box-alice.internal",
      "ip_address": "192.168.1.104",
      "owner": "Alice Developer",
      "criticality": "Low",
      "cpe_uri": "cpe:2.3:a:nodejs:node.js:14.17.0:*:*:*:*:*:*:*"
    },
    {
      "software_name": "Tomcat",
      "version": "9.0.45",
      "environment": "Production",
      "hostname": "app-srv-02.internal",
      "ip_address": "10.140.0.33",
      "owner": "Java Middleware",
      "criticality": "High",
      "cpe_uri": "cpe:2.3:a:apache:tomcat:9.0.45:*:*:*:*:*:*:*"
    }
  ], null, 2));
}
if (!fs.existsSync(CVE_SOURCES_PATH)) {
  fs.writeFileSync(CVE_SOURCES_PATH, JSON.stringify({
    "nvd_enabled": true,
    "microsoft_enabled": true,
    "ubuntu_enabled": true,
    "cisco_enabled": true
  }, null, 2));
}
if (!fs.existsSync(SCAN_SETTINGS_PATH)) {
  fs.writeFileSync(SCAN_SETTINGS_PATH, JSON.stringify({ "auto_scan": false, "scan_window_days": 7 }, null, 2));
}
if (!fs.existsSync(USERS_PATH)) {
  fs.writeFileSync(USERS_PATH, JSON.stringify([
    { "username": "admin", "role": "admin" },
    { "username": "analyst", "role": "analyst" },
    { "username": "viewer", "role": "viewer" },
    { "username": "suman", "role": "admin" }
  ], null, 2));
}

// Global active in-memory state for vulnerabilities matching the inventory
interface Vulnerability {
  id: number;
  cve_id: string;
  software_name: string;
  version: string;
  environment: string;
  summary: string;
  cvss_score: number;
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
  hostname?: string;
  ip_address?: string;
  owner?: string;
  criticality?: string;
  cpe_uri?: string;
  affected_cpe?: string;
  is_zero_day?: boolean;
}

// Software aliases definition
const SOFTWARE_ALIASES: Record<string, string[]> = {
  "apache http server": ["apache", "httpd", "apache2", "apache httpd", "web server"],
  "openssl": ["openssl", "ssl", "libssl", "openssl-library"],
  "nginx": ["nginx", "nginx engine", "nginx-core", "nginx webserver"],
  "postgresql": ["postgres", "postgresql", "pgsql", "postgres-db"],
  "nodejs": ["node", "node.js", "nodejs", "node-js"],
  "tomcat": ["tomcat", "apache tomcat", "tomcat-server", "apache-tomcat"],
  "glibc": ["gnu c library", "glibc", "libc", "libc6"],
  "cisco ios xe": ["cisco ios xe", "ios xe", "ios-xe", "cisco-ios-xe"],
  "microsoft outlook": ["microsoft outlook", "outlook", "outlook 2016", "outlook 2021"],
  "windows server 2019": ["windows server", "windows server 2019", "windows", "win-server"]
};

// Fuzzy string matching algorithms (Levenshtein distance & bigram matching)
function LevenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

function getStringSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().trim();
  const clean2 = s2.toLowerCase().trim();
  const len = Math.max(clean1.length, clean2.length);
  if (len === 0) return 1.0;
  return 1.0 - LevenshteinDistance(clean1, clean2) / len;
}

function areSoftwareAliases(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  if (n1 === n2) return true;
  
  // Find primary name for n1 and n2
  let prim1 = n1;
  let prim2 = n2;
  
  for (const [primary, aliases] of Object.entries(SOFTWARE_ALIASES)) {
    if (primary === n1 || aliases.includes(n1)) {
      prim1 = primary;
    }
    if (primary === n2 || aliases.includes(n2)) {
      prim2 = primary;
    }
  }
  
  return prim1 === prim2;
}

// Highly descriptive vulnerability definitions from multiple feeds
const MOCK_CVES: Omit<Vulnerability, "id" | "status" | "assigned_engineer" | "detected_at" | "version" | "environment">[] = [
  {
    cve_id: "CVE-2026-9999",
    software_name: "Apache HTTP Server",
    summary: "URGENT ZERO-DAY: Remote Code Execution via crafted chunked transfer requests in mod_proxy_http. Active exploitation observed in the wild.",
    cvss_score: 10.0,
    published_date: "2026-07-04T08:00:00Z",
    age_days: 1,
    source: "CISA KEV",
    affected_cpe: "cpe:2.3:a:apache:http_server",
    is_zero_day: true,
    impact_analysis: "CRITICAL OUTBREAK: Allows an unauthenticated remote attacker to execute arbitrary shell commands on target production web servers running behind mod_proxy. Immediate mitigation required.",
    mitigation: "Immediate Technical Workaround: Disable 'mod_proxy' module in your httpd.conf configuration OR set 'ProxyRequests Off' if not strictly needed. Restrict access to external interfaces via network level firewalls.",
    remediation_links: ["https://nvd.nist.gov/vuln/detail/CVE-2026-9999", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"]
  },
  {
    cve_id: "CVE-2026-8888",
    software_name: "OpenSSL",
    summary: "URGENT ZERO-DAY: Remote Memory Disclosure and Key Leak (Heartbleed-NG) via TLS v1.3 malformed ClientHello messages. Active proof-of-concept circulating.",
    cvss_score: 9.9,
    published_date: "2026-07-03T14:30:00Z",
    age_days: 2,
    source: "OpenSSL Security Team",
    affected_cpe: "cpe:2.3:a:openssl:openssl",
    is_zero_day: true,
    impact_analysis: "CRITICAL OUTBREAK: Allows attackers to read up to 128KB of private memory buffers per packet, exposing server private keys, user passwords, session tokens, and cleartext communications.",
    mitigation: "Immediate Technical Workaround: Deploy an intrusion prevention system (IPS) signature for SSL ClientHello overflow packets, or downgrade to SSL TLS 1.2 temporarily where supported.",
    remediation_links: ["https://www.openssl.org/news/secadv/20260703.txt", "https://nvd.nist.gov/vuln/detail/CVE-2026-8888"]
  },
  {
    cve_id: "CVE-2021-41773",
    software_name: "Apache HTTP Server",
    summary: "Path traversal and file disclosure vulnerability in Apache HTTP Server. Attackers can map URLs to files outside the document root.",
    cvss_score: 7.5,
    published_date: "2021-10-05T12:00:00Z",
    age_days: 1730,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:apache:http_server",
    impact_analysis: "High impact on confidentiality. If the files outside the document root are not protected by 'Require all denied', attackers can read sensitive system configuration files (e.g., /etc/passwd or application variables).",
    mitigation: "Workaround: Add directive 'Require all denied' for all filesystem paths outside the document root in httpd.conf.",
    remediation_links: ["https://nvd.nist.gov/vuln/detail/CVE-2021-41773", "https://httpd.apache.org/security/vulnerabilities_24.html"]
  },
  {
    cve_id: "CVE-2021-42013",
    software_name: "Apache HTTP Server",
    summary: "Remote Code Execution vulnerability in Apache HTTP Server. An attacker could use a path traversal attack to map URLs to files outside the document root and execute CGI scripts.",
    cvss_score: 9.8,
    published_date: "2021-10-07T12:00:00Z",
    age_days: 1728,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:apache:http_server",
    impact_analysis: "Critical impact. This allows remote administrative shell access. Attackers can bypass previous path-traversal mitigations to upload and run binaries or scripts as the daemon user.",
    mitigation: "Workaround: Disable mod_cgi and mod_cgid and ensure directory controls restrict execution.",
    remediation_links: ["https://nvd.nist.gov/vuln/detail/CVE-2021-42013", "https://www.cisa.gov/news-events/alerts/2021/10/07/apache-releases-security-advisory-apache-http-server"]
  },
  {
    cve_id: "CVE-2021-3711",
    software_name: "OpenSSL",
    summary: "SM2 Decryption Buffer Overflow in OpenSSL. A malicious attacker can cause a buffer overflow during decryption, leading to an application crash or remote code execution.",
    cvss_score: 9.8,
    published_date: "2021-08-24T12:00:00Z",
    age_days: 1772,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:openssl:openssl",
    impact_analysis: "Critical system disruption. Attackers sending malformed SM2 ciphertext can cause memory corruption. This can crash background SSL listeners or execute arbitrary system binaries on the hosting machine.",
    mitigation: "Workaround: Disable SM2-based cipher suites in your TLS configuration.",
    remediation_links: ["https://www.openssl.org/news/secadv/20210824.txt", "https://nvd.nist.gov/vuln/detail/CVE-2021-3711"]
  },
  {
    cve_id: "CVE-2021-3712",
    software_name: "OpenSSL",
    summary: "ASN.1 Structure Read Buffer Overrun in OpenSSL. An attacker can trigger an out-of-bounds read by presenting crafted certificates, causing denial of service or private memory exposure.",
    cvss_score: 7.5,
    published_date: "2021-08-24T12:00:00Z",
    age_days: 1772,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:openssl:openssl",
    impact_analysis: "Moderate-High threat. Enables attackers to read garbage memory buffers. This can expose secret TLS private keys or crash client connection threads repeatedly.",
    mitigation: "Workaround: Restrict certificate validation chains to trusted public roots only.",
    remediation_links: ["https://www.openssl.org/news/secadv/20210824.txt"]
  },
  {
    cve_id: "CVE-2021-23017",
    software_name: "nginx",
    summary: "Off-by-one buffer overflow in the DNS resolver of nginx. A local or remote attacker using a malicious DNS response can cause worker process crash or potential code execution.",
    cvss_score: 8.1,
    published_date: "2021-05-25T12:00:00Z",
    age_days: 1863,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:nginx:nginx",
    impact_analysis: "High availability and integrity impact. Vulnerability occurs when nginx parses custom DNS responses during proxy resolution. Exploitation leads to container crashes or shell script executions.",
    mitigation: "Workaround: Hardcode IP addresses in upstream definitions instead of using dynamic DNS naming.",
    remediation_links: ["https://nginx.org/en/security_advisories.html", "https://nvd.nist.gov/vuln/detail/CVE-2021-23017"]
  },
  {
    cve_id: "CVE-2021-32027",
    software_name: "PostgreSQL",
    summary: "Integer overflow in PostgreSQL. An authenticated user can perform out-of-bounds writes leading to privilege escalation or database service crash.",
    cvss_score: 8.8,
    published_date: "2021-05-13T12:00:00Z",
    age_days: 1875,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:postgresql:postgresql",
    impact_analysis: "Database takeover risk. Authenticated analysts with restricted schema permissions can elevate to SUPERUSER status or crash the database cluster.",
    mitigation: "Workaround: Revoke CREATE and UPDATE permissions from untrusted database users.",
    remediation_links: ["https://www.postgresql.org/support/security/", "https://nvd.nist.gov/vuln/detail/CVE-2021-32027"]
  },
  {
    cve_id: "CVE-2021-22930",
    software_name: "Node.js",
    summary: "Use-after-free vulnerability in HTTP2 implementation of Node.js. A remote attacker can exploit this during active streams to crash the server or execute arbitrary code.",
    cvss_score: 8.2,
    published_date: "2021-07-29T12:00:00Z",
    age_days: 1798,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:nodejs:node.js",
    impact_analysis: "High severity. Allows remote attackers to corrupt Node.js memory heaps using malformed multiplexed streams, causing runtime daemon execution bypasses.",
    mitigation: "Workaround: Disable HTTP/2 services or route traffic through an external gateway like Cloudflare.",
    remediation_links: ["https://nodejs.org/en/blog/vulnerability/july-2021-security-releases/"]
  },
  {
    cve_id: "CVE-2021-33037",
    software_name: "Tomcat",
    summary: "HTTP Request Smuggling vulnerability in Tomcat. Reverse proxies forwarding requests to Tomcat might permit unauthorized access to administrative endpoints.",
    cvss_score: 7.5,
    published_date: "2021-06-16T12:00:00Z",
    age_days: 1841,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:apache:tomcat",
    impact_analysis: "Bypasses frontend access control policies. Attackers can smuggle hidden administrative payloads into normal requests to access private Tomcat manager pages.",
    mitigation: "Workaround: Align Keep-Alive timeout parameters between your frontend proxy and backend Tomcat service.",
    remediation_links: ["https://tomcat.apache.org/security-9.html"]
  },
  // Microsoft Security Advisories
  {
    cve_id: "CVE-2022-26925",
    software_name: "Windows Server 2019",
    summary: "Active Directory LSA Spoofing vulnerability. Allows elevated privilege relaying to domain control authority.",
    cvss_score: 8.1,
    published_date: "2022-05-10T12:00:00Z",
    age_days: 1515,
    source: "Microsoft",
    affected_cpe: "cpe:2.3:o:microsoft:windows_server_2019",
    impact_analysis: "Critical security risk for enterprise authentication. An attacker can hijack security tokens by spoofing the LSA RPC protocol, leading to full domain takeover.",
    mitigation: "Workaround: Enable SMB Signing and LDAP Channel Binding on all domain controllers.",
    remediation_links: ["https://msrc.microsoft.com/update-guide/vulnerability/CVE-2022-26925"]
  },
  {
    cve_id: "CVE-2023-23397",
    software_name: "Microsoft Outlook",
    summary: "Microsoft Outlook Privilege Escalation Vulnerability. Attackers can trigger credential leaks silently.",
    cvss_score: 9.8,
    published_date: "2023-03-14T12:00:00Z",
    age_days: 1209,
    source: "Microsoft",
    affected_cpe: "cpe:2.3:a:microsoft:outlook",
    impact_analysis: "Extremely critical. Triggers automatically when a reminder is loaded by the user, requiring zero clicks. The client sends NetNTLMv2 hashes to a malicious external server.",
    mitigation: "Workaround: Block outbound TCP Port 445 (SMB) at the perimeter firewall.",
    remediation_links: ["https://msrc.microsoft.com/update-guide/vulnerability/CVE-2023-23397"]
  },
  // Ubuntu Security Bulletins
  {
    cve_id: "CVE-2023-4911",
    software_name: "glibc",
    summary: "Looney Tunables local privilege escalation in the GNU C Library (glibc) dynamic loader (ld.so).",
    cvss_score: 7.8,
    published_date: "2023-10-03T12:00:00Z",
    age_days: 1006,
    source: "Ubuntu",
    affected_cpe: "cpe:2.3:a:gnu:glibc",
    impact_analysis: "High threat. Any local user with low privileges can gain complete root access on Ubuntu Linux by exploiting an overflow in GLIBC_TUNABLES variable parsing.",
    mitigation: "Workaround: There is no known configuration workaround. Security must be established by immediate library update.",
    remediation_links: ["https://ubuntu.com/security/CVE-2023-4911", "https://www.qualys.com/2023/10/03/cve-2023-4911/looney-tunables-local-privilege-escalation-glibc-dynamic-loader.txt"]
  },
  // Cisco Advisories
  {
    cve_id: "CVE-2023-20073",
    software_name: "Cisco IOS XE",
    summary: "Cisco IOS XE Software Command Injection Vulnerability. Allows web UI administrators to execute system commands as root.",
    cvss_score: 8.8,
    published_date: "2023-03-15T12:00:00Z",
    age_days: 1208,
    source: "Cisco",
    affected_cpe: "cpe:2.3:o:cisco:ios_xe",
    impact_analysis: "Allows fully compromised router and switch execution blocks. Authenticated web admin interfaces can be abused to execute commands directly on the underlying Linux host.",
    mitigation: "Workaround: Disable Cisco IOS XE Web HTTP server engine.",
    remediation_links: ["https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-iosxe-cmdinj-c9FvR6C"]
  }
];

// Helper to generate remediation commands
function getRemediationSteps(cve_id: string, software_name: string, version: string): string {
  const s = software_name.toLowerCase();
  let verifyL = "which apache2 && apache2 -v";
  let mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade apache2";
  let verifyW = 'Get-Service -Name "*Apache*"';
  let mitigateW = "Stop-Service -Name 'Apache*'\n# Extract latest apache binaries...";

  if (s.includes("openssl")) {
    verifyL = "openssl version";
    mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade openssl";
    verifyW = "[System.Diagnostics.FileVersionInfo]::GetVersionInfo((Get-Command openssl.exe).Source).FileVersion";
    mitigateW = "# Update openssl installer binaries";
  } else if (s.includes("nginx")) {
    verifyL = "nginx -v";
    mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade nginx";
    verifyW = "& 'C:\\nginx\\nginx.exe' -v";
    mitigateW = "Stop-Process -Name 'nginx'\n# Copy nginx binaries";
  } else if (s.includes("postgres")) {
    verifyL = 'psql -U postgres -c "SELECT version();"';
    mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade postgresql-12";
    verifyW = "& 'C:\\Program Files\\PostgreSQL\\12\\bin\\postgres.exe' --version";
    mitigateW = "Stop-Service -Name 'postgresql*'\n# Upgrade PostgreSQL database engine";
  } else if (s.includes("node")) {
    verifyL = "node -v";
    mitigateL = "sudo apt-get update && sudo apt-get install -y nodejs";
    verifyW = "node -v";
    mitigateW = "choco upgrade nodejs -y";
  } else if (s.includes("tomcat")) {
    verifyL = "catalina.sh version";
    mitigateL = "wget https://dlcdn.apache.org/tomcat/tomcat-9/v9.0.75/bin/apache-tomcat-9.0.75.tar.gz";
    verifyW = "& 'C:\\tomcat\\bin\\version.bat'";
    mitigateW = "Stop-Service -Name 'Tomcat*'\n# Update Tomcat binaries";
  } else if (s.includes("glibc")) {
    verifyL = "ldd --version";
    mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade libc6 -y";
    verifyW = "# Linux system only library";
    mitigateW = "# Linux library only";
  } else if (s.includes("cisco")) {
    verifyL = "show version | grep IOS-XE";
    mitigateL = "copy tftp://10.1.1.1/cat9k-lite.17.03.05.SPA.bin bootflash:\nboot system bootflash:cat9k-lite.17.03.05.SPA.bin";
    verifyW = "# Enterprise Network Appliance CLI";
    mitigateW = "# Network Appliance Switch Engine Upgrade";
  } else if (s.includes("outlook") || s.includes("windows")) {
    verifyL = "# Microsoft Windows Software component";
    mitigateL = "# Install patch via SCCM agent";
    verifyW = "Get-HotFix -Id KB5014754";
    mitigateW = "Install-WUUpdates -KB5014754 -AcceptAll -AutoReboot";
  }

  return `### Remediation Guide for ${cve_id} in ${software_name} (Current Version: ${version})

#### Linux / Bash Environment

##### 1. Verification Command
\`\`\`bash
${verifyL}
\`\`\`

##### 2. Mitigation Command
\`\`\`bash
${mitigateL}
\`\`\`

---

#### Windows / PowerShell Environment

##### 1. Verification Command
\`\`\`powershell
${verifyW}
\`\`\`

##### 2. Mitigation Command
\`\`\`powershell
${mitigateW}
\`\`\`
`;
}

// Simulated databases in memory (preserves status changes & assignments across refreshes)
let matchedVulnerabilities: Vulnerability[] = [];
let scanProgress = { is_scanning: false, percentage: 0, current_cve: "" };
let scanHasRunOnce = false;

// HTTP API endpoints

// 1. Unauthenticated health route
app.get("/health/data", (req, res) => {
  try {
    const records = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
    res.json({ ready: true, inventory_loaded: true, count: records.length });
  } catch (err) {
    res.json({ ready: false, error: String(err) });
  }
});

// 2. Auth endpoint
app.post("/api/v1/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ detail: "Username required" });
  }
  
  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    const matchedUser = users.find((u: any) => u.username === username);
    if (!matchedUser) {
      return res.status(401).json({ detail: "User does not exist in Sandbox user directory." });
    }
    
    // Simple verification (password is the same as username in sandbox)
    if (password === username) {
      return res.json({
        access_token: "mock_jwt_token_" + matchedUser.role + "_" + Date.now(),
        token_type: "bearer",
        username: username,
        role: matchedUser.role
      });
    }
  } catch (err) {
    return res.status(500).json({ detail: "Database access error" });
  }

  return res.status(401).json({ detail: "Incorrect password. (Hint: password is the same as username)" });
});

// 3. User Management endpoints
app.get("/api/v1/users", (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    res.json(users);
  } catch (err) {
    res.status(500).json({ detail: "Failed to read users" });
  }
});

app.post("/api/v1/users", (req, res) => {
  const { username, role } = req.body;
  if (!username || !role) {
    return res.status(400).json({ detail: "Username and role are required." });
  }

  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ detail: "User already exists." });
    }

    users.push({ username, role });
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    res.json({ status: "success", users });
  } catch (err) {
    res.status(500).json({ detail: "Failed to save user" });
  }
});

app.delete("/api/v1/users/:username", (req, res) => {
  const { username } = req.params;
  try {
    let users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    users = users.filter((u: any) => u.username.toLowerCase() !== username.toLowerCase());
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    res.json({ status: "success", users });
  } catch (err) {
    res.status(500).json({ detail: "Failed to delete user" });
  }
});

app.patch("/api/v1/users/:username/role", (req, res) => {
  const { username } = req.params;
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ detail: "Role required" });
  }

  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    const matched = users.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
    if (!matched) {
      return res.status(444).json({ detail: "User not found" });
    }
    matched.role = role;
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
    res.json({ status: "success", users });
  } catch (err) {
    res.status(500).json({ detail: "Failed to update role" });
  }
});

// 4. Stats Endpoint
app.get("/api/v1/dashboard/stats", (req, res) => {
  const settings = JSON.parse(fs.readFileSync(SCAN_SETTINGS_PATH, "utf-8"));
  const records = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
  
  if (!settings.auto_scan && !scanHasRunOnce) {
    return res.json({
      inventory_count: records.length,
      open_vulns_count: 0,
      high_critical_count: 0,
      total_matches_count: 0,
      zero_day_count: 0
    });
  }

  const openVulns = matchedVulnerabilities.filter(v => v.status === "Open");
  const highCritical = openVulns.filter(v => v.cvss_score >= 7.0);
  const zeroDayCount = openVulns.filter(v => v.is_zero_day).length;

  res.json({
    inventory_count: records.length,
    open_vulns_count: openVulns.length,
    high_critical_count: highCritical.length,
    total_matches_count: matchedVulnerabilities.length,
    zero_day_count: zeroDayCount
  });
});

// 5. Inventory endpoints
app.get("/api/v1/inventory", (req, res) => {
  const records = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
  const mapped = records.map((r: any, idx: number) => ({
    id: idx + 1,
    software_name: r.software_name,
    version: r.version,
    environment: r.environment || "Production",
    hostname: r.hostname || "web-prod-" + (idx + 1) + ".internal",
    ip_address: r.ip_address || "10.0.1." + (10 + idx),
    owner: r.owner || "Infrastructure",
    criticality: r.criticality || "Medium",
    cpe_uri: r.cpe_uri || `cpe:2.3:a:${r.software_name.toLowerCase().replace(/\s+/g, '_')}:${r.software_name.toLowerCase().replace(/\s+/g, '_')}:${r.version}:*:*:*:*:*:*:*`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  res.json(mapped);
});

// Advanced File Upload Endpoint for Inventory Items (XLS, CSV, JSON)
app.post("/api/v1/inventory/upload", (req, res) => {
  const { fileData, fileName, fileType } = req.body;
  if (!fileData || !fileName || !fileType) {
    return res.status(400).json({ detail: "Missing fileData, fileName or fileType parameters." });
  }

  try {
    const buffer = Buffer.from(fileData, "base64");
    let parsedItems: any[] = [];

    if (fileType === "json") {
      const text = buffer.toString("utf-8");
      parsedItems = JSON.parse(text);
    } else {
      // Handles CSV, XLS, XLSX using xlsx parser
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      parsedItems = xlsx.utils.sheet_to_json(worksheet);
    }

    if (!Array.isArray(parsedItems)) {
      parsedItems = [parsedItems];
    }

    // Normalize keys to support flexible client headers
    const normalized = parsedItems.map((item: any) => {
      const normalizedItem: any = {};
      
      const keys = Object.keys(item);
      const findVal = (possibleKeys: string[], defaultVal = "") => {
        const foundKey = keys.find(k => possibleKeys.includes(k.toLowerCase().replace(/[\s_]+/g, "")));
        return foundKey !== undefined ? String(item[foundKey]) : defaultVal;
      };

      normalizedItem.software_name = findVal(["softwarename", "software", "name", "softwareitem", "packagename"]);
      normalizedItem.version = findVal(["version", "ver", "softwareversion", "pkgversion"]);
      normalizedItem.environment = findVal(["environment", "env", "scope"], "Production");
      normalizedItem.hostname = findVal(["hostname", "host", "ciname", "server", "machine"], "web-prod-uploaded.internal");
      normalizedItem.ip_address = findVal(["ipaddress", "ip", "hostip", "ipaddr"], "10.0.1.99");
      normalizedItem.owner = findVal(["owner", "contact", "custodian", "department"], "Security Operations");
      normalizedItem.criticality = findVal(["criticality", "critical", "tier", "severity"], "High");
      normalizedItem.cpe_uri = findVal(["cpe", "cpeuri", "cpe23"], `cpe:2.3:a:${normalizedItem.software_name.toLowerCase().replace(/[\s_]+/g, "_")}:${normalizedItem.software_name.toLowerCase().replace(/[\s_]+/g, "_")}:${normalizedItem.version}:*:*:*:*:*:*:*`);

      return normalizedItem;
    }).filter(item => item.software_name && item.version);

    if (normalized.length === 0) {
      return res.status(400).json({ detail: "No valid software items detected. Make sure your file contains Software Name and Version headers." });
    }

    // Write back to inventory.json
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(normalized, null, 2));

    broadcast({
      event: "inventory_updated"
    });

    res.json({
      status: "success",
      message: `Successfully uploaded and ingested ${normalized.length} inventory systems.`,
      count: normalized.length,
      items: normalized
    });

  } catch (err) {
    res.status(500).json({ detail: "Parsing failed: " + String(err) });
  }
});

app.post("/api/v1/inventory/ingest", (req, res) => {
  res.json({ status: "success", message: "Successfully re-ingested local configuration databases." });
});

// 6. Vulnerabilities List (Filtered and paginated)
app.get("/api/v1/vulnerabilities", (req, res) => {
  const settings = JSON.parse(fs.readFileSync(SCAN_SETTINGS_PATH, "utf-8"));
  
  if (!settings.auto_scan && !scanHasRunOnce) {
    return res.json({ vulnerabilities: [], total: 0, page: 1, limit: 500 });
  }

  const { search, status, severity, min_age, max_age, page = "1", limit = "500" } = req.query;

  let list = [...matchedVulnerabilities];

  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter(v => v.cve_id.toLowerCase().includes(s) || v.software_name.toLowerCase().includes(s));
  }

  if (status) {
    list = list.filter(v => v.status === status);
  }

  if (severity) {
    if (severity === "Critical") {
      list = list.filter(v => v.cvss_score >= 9.0);
    } else if (severity === "High") {
      list = list.filter(v => v.cvss_score >= 7.0 && v.cvss_score < 9.0);
    } else if (severity === "Medium") {
      list = list.filter(v => v.cvss_score >= 4.0 && v.cvss_score < 7.0);
    } else if (severity === "Low") {
      list = list.filter(v => v.cvss_score < 4.0);
    }
  }

  if (min_age) {
    list = list.filter(v => v.age_days >= parseInt(String(min_age)));
  }
  if (max_age) {
    list = list.filter(v => v.age_days <= parseInt(String(max_age)));
  }

  const pageNum = parseInt(String(page));
  const limitNum = parseInt(String(limit));
  const total = list.length;
  
  const start = (pageNum - 1) * limitNum;
  const paginated = list.slice(start, start + limitNum);

  res.json({
    vulnerabilities: paginated,
    total: total,
    page: pageNum,
    limit: limitNum
  });
});

app.get("/api/v1/vulnerabilities/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const vuln = matchedVulnerabilities.find(v => v.id === id);
  if (!vuln) {
    return res.status(404).json({ detail: "Vulnerability not found" });
  }
  vuln.remediation_steps = getRemediationSteps(vuln.cve_id, vuln.software_name, vuln.version);
  res.json(vuln);
});

app.patch("/api/v1/vulnerabilities/:id/status", (req, res) => {
  const id = parseInt(req.params.id);
  const vuln = matchedVulnerabilities.find(v => v.id === id);
  if (!vuln) {
    return res.status(404).json({ detail: "Vulnerability not found" });
  }

  const { status, assigned_engineer } = req.body;
  if (status !== undefined) {
    vuln.status = status;
  }
  if (assigned_engineer !== undefined) {
    vuln.assigned_engineer = assigned_engineer;
  }

  // Broadcast WebSocket alert
  broadcast({
    event: "status_changed",
    vulnerability_id: id,
    status: vuln.status,
    assigned_engineer: vuln.assigned_engineer
  });

  res.json(vuln);
});

// Autonomous AI Patching Agent Simulation (Directly updates configuration items!)
app.post("/api/v1/vulnerabilities/:id/remediate-agent", (req, res) => {
  const id = parseInt(req.params.id);
  const vuln = matchedVulnerabilities.find(v => v.id === id);
  if (!vuln) {
    return res.status(404).json({ detail: "Vulnerability not found" });
  }

  // Generate real-time execution bash output steps
  const logs: string[] = [
    `[AGENT] Initiating autonomous security patching agent...`,
    `[AGENT] Active connection to host: ${vuln.hostname || "web-prod-srv.internal"} (IP: ${vuln.ip_address || "10.0.1.15"}) secured.`,
    `[AGENT] Performing dependency checking on target package: ${vuln.software_name} (Current Version: ${vuln.version})`,
    `[AGENT] Querying available compliant package repositories...`
  ];

  const s = vuln.software_name.toLowerCase();
  let patchedVer = vuln.version;
  if (s.includes("apache") && !s.includes("tomcat")) {
    patchedVer = "2.4.52";
    logs.push(`[AGENT] Executing remote shell: sudo apt-get update && sudo apt-get install --only-upgrade apache2 -y`);
    logs.push(`[AGENT] Package upgrades running: apache2: ${vuln.version} -> 2.4.52`);
  } else if (s.includes("openssl")) {
    patchedVer = "1.1.1q";
    logs.push(`[AGENT] Executing remote shell: sudo apt-get update && sudo apt-get install --only-upgrade openssl -y`);
    logs.push(`[AGENT] Package upgrades running: openssl: ${vuln.version} -> 1.1.1q`);
  } else if (s.includes("nginx")) {
    patchedVer = "1.22.1";
    logs.push(`[AGENT] Executing remote shell: sudo apt-get update && sudo apt-get install --only-upgrade nginx -y`);
    logs.push(`[AGENT] Package upgrades running: nginx: ${vuln.version} -> 1.22.1`);
  } else if (s.includes("postgres")) {
    patchedVer = "12.15";
    logs.push(`[AGENT] Executing database upgrade script: pg_upgradecluster 12 main`);
    logs.push(`[AGENT] Database binaries upgraded: postgresql-12: ${vuln.version} -> 12.15`);
  } else if (s.includes("node")) {
    patchedVer = "14.21.3";
    logs.push(`[AGENT] Deploying upgraded Node environment via NVM managers...`);
    logs.push(`[AGENT] Node.js upgraded: ${vuln.version} -> 14.21.3`);
  } else if (s.includes("tomcat")) {
    patchedVer = "9.0.75";
    logs.push(`[AGENT] Updating catalina java environment buffers...`);
    logs.push(`[AGENT] Tomcat binaries upgraded: ${vuln.version} -> 9.0.75`);
  } else if (s.includes("glibc")) {
    patchedVer = "2.35-ubuntu4";
    logs.push(`[AGENT] Installing security patches for Linux core loader: ld.so...`);
    logs.push(`[AGENT] Glibc package upgraded: ${vuln.version} -> 2.35-ubuntu4`);
  } else if (s.includes("cisco")) {
    patchedVer = "17.3.5";
    logs.push(`[AGENT] Opening Cisco command terminal shell...`);
    logs.push(`[AGENT] Installing firmware update image SPA.bin via TFTP server...`);
    logs.push(`[AGENT] Cisco IOS-XE upgraded: ${vuln.version} -> 17.3.5`);
  } else if (s.includes("outlook")) {
    patchedVer = "2021";
    logs.push(`[AGENT] Pushing Outlook patch KB9283741 via administrative endpoint controller...`);
    logs.push(`[AGENT] Outlook upgraded: ${vuln.version} -> 2021`);
  } else if (s.includes("windows")) {
    patchedVer = "10.0.17763.4377";
    logs.push(`[AGENT] Launching Windows Patch Manager...`);
    logs.push(`[AGENT] Windows update Hotfix KB5014754 applied successfully.`);
  }

  logs.push(`[AGENT] Reloading system services to apply patched configurations...`);
  logs.push(`[AGENT] Executing verification test: ${s.includes("openssl") ? "openssl version" : s.includes("apache") ? "apache2 -v" : "version_check"}`);
  logs.push(`[AGENT] Verification successful. compliant version running: ${patchedVer}`);
  logs.push(`[AGENT] Autonomous security audit passed. Mitigating CVE advisory item.`);

  // Update in-memory vuln state
  vuln.status = "Mitigated";
  vuln.assigned_engineer = "AI Patching Agent";

  // Persistent update inside inventory.json file
  try {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
    const idx = inventory.findIndex((item: any) => 
      item.software_name.toLowerCase() === vuln.software_name.toLowerCase() &&
      (!vuln.hostname || item.hostname === vuln.hostname)
    );
    if (idx !== -1) {
      inventory[idx].version = patchedVer;
      // also update CPE
      if (inventory[idx].cpe_uri) {
        const parts = inventory[idx].cpe_uri.split(":");
        if (parts.length >= 6) {
          parts[5] = patchedVer;
          inventory[idx].cpe_uri = parts.join(":");
        }
      }
      fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
    }
  } catch (err) {
    console.error("Failed to update inventory during agent patch simulation:", err);
  }

  // Broadcast WebSocket alert
  broadcast({
    event: "status_changed",
    vulnerability_id: id,
    status: "Mitigated",
    assigned_engineer: "AI Patching Agent"
  });

  broadcast({
    event: "inventory_updated"
  });

  res.json({
    status: "success",
    message: "Security issue resolved successfully by the AI Patching Agent.",
    patched_version: patchedVer,
    logs: logs
  });
});

// Excel Export - outputs a perfect Excel-compatible CSV file
app.post("/api/v1/vulnerabilities/export", (req, res) => {
  const { ids } = req.body;
  let targetList = matchedVulnerabilities;
  if (ids && ids.length > 0) {
    targetList = matchedVulnerabilities.filter(v => ids.includes(v.id));
  }

  // Generate clean Excel CSV format
  let csvContent = "\uFEFFVulnerability ID,Software Name,Version,Host,IP Address,Environment,CVSS Score,Status,Assigned Engineer,Source Feed,Published Date,Detected At\n";
  for (const v of targetList) {
    csvContent += `"${v.cve_id}","${v.software_name}","${v.version}","${v.hostname || 'N/A'}","${v.ip_address || 'N/A'}","${v.environment}",${v.cvss_score},"${v.status}","${v.assigned_engineer || 'Unassigned'}","${v.source || 'NVD'}","${v.published_date}","${v.detected_at}"\n`;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=vulnerability_report.csv");
  res.send(csvContent);
});

// 7. CVE Sources
app.get("/api/v1/cve-sources", (req, res) => {
  const config = JSON.parse(fs.readFileSync(CVE_SOURCES_PATH, "utf-8"));
  res.json(config);
});

app.patch("/api/v1/cve-sources", (req, res) => {
  const { nvd_enabled, microsoft_enabled, ubuntu_enabled, cisco_enabled } = req.body;
  const config = {
    nvd_enabled: nvd_enabled !== undefined ? !!nvd_enabled : true,
    microsoft_enabled: microsoft_enabled !== undefined ? !!microsoft_enabled : true,
    ubuntu_enabled: ubuntu_enabled !== undefined ? !!ubuntu_enabled : true,
    cisco_enabled: cisco_enabled !== undefined ? !!cisco_enabled : true,
  };
  fs.writeFileSync(CVE_SOURCES_PATH, JSON.stringify(config, null, 2));
  res.json(config);
});

// 8. Scan Settings
app.get("/api/v1/scan/settings", (req, res) => {
  const config = JSON.parse(fs.readFileSync(SCAN_SETTINGS_PATH, "utf-8"));
  res.json(config);
});

app.patch("/api/v1/scan/settings", (req, res) => {
  const { auto_scan, scan_window_days } = req.body;
  const config = { auto_scan: !!auto_scan, scan_window_days: parseInt(String(scan_window_days)) || 7 };
  fs.writeFileSync(SCAN_SETTINGS_PATH, JSON.stringify(config, null, 2));
  res.json(config);
});

// 9. CMDB Scan Trigger (Real WebSocket feedback progress loop!)
app.post("/api/v1/scan/cmdb", async (req, res) => {
  const { cve_id } = req.body;
  if (scanProgress.is_scanning) {
    return res.status(400).json({ detail: "A scan is already in progress." });
  }

  scanProgress.is_scanning = true;
  scanProgress.percentage = 0;
  scanProgress.current_cve = "Initializing security databases...";

  let currentPercentage = 0;
  const timer = setInterval(() => {
    currentPercentage += 10;
    if (currentPercentage > 100) {
      clearInterval(timer);
      scanProgress.is_scanning = false;
      scanProgress.percentage = 100;
      scanProgress.current_cve = "Finished!";
      scanHasRunOnce = true;

      // Build matched entries matching the inventory software exactly
      const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
      const sources = JSON.parse(fs.readFileSync(CVE_SOURCES_PATH, "utf-8"));
      matchedVulnerabilities = [];
      let nextId = 1;

      for (const item of inventory) {
        const itemLower = item.software_name.toLowerCase();
        
        for (const cve of MOCK_CVES) {
          // A. Source Feed Toggle Check
          const sourceKey = `${cve.source?.toLowerCase()}_enabled`;
          if (!sources[sourceKey]) {
            continue; // Skip this source since it is disabled
          }

          // B. Filter by single CVE ID if provided
          if (cve_id && cve.cve_id.toLowerCase() !== cve_id.toLowerCase()) {
            continue;
          }

          let isMatch = false;
          let matchType = "";

          // C. CPE URI Deterministic Correlation
          if (item.cpe_uri && cve.affected_cpe) {
            const itemParts = item.cpe_uri.split(":");
            const cveParts = cve.affected_cpe.split(":");
            if (itemParts.length >= 5 && cveParts.length >= 5) {
              const itemVendor = itemParts[3];
              const itemProduct = itemParts[4];
              const cveVendor = cveParts[3];
              const cveProduct = cveParts[4];
              
              if (itemVendor === cveVendor && itemProduct === cveProduct) {
                // Product matched. Check version matching.
                const cveVersion = cveParts[5] || "*";
                if (cveVersion === "*" || cveVersion === itemParts[5] || item.version.includes(cveVersion) || item.version === cveVersion) {
                  isMatch = true;
                  matchType = "CPE correlation";
                }
              }
            }
          }

          // D. Software Name Alias Match Correlation
          if (!isMatch) {
            if (areSoftwareAliases(item.software_name, cve.software_name)) {
              isMatch = true;
              matchType = "Software alias matching";
            }
          }

          // E. Fuzzy String Match Algorithm (Normalized Levenshtein >= 75%)
          if (!isMatch) {
            const similarity = getStringSimilarity(item.software_name, cve.software_name);
            if (similarity >= 0.75) {
              isMatch = true;
              matchType = `Fuzzy name matching (${Math.round(similarity * 100)}% similarity)`;
            }
          }

          // Verify version is not the patched version to avoid matching already upgraded systems
          if (isMatch) {
            // Quick check: If system is upgraded already, don't flag as vulnerable
            const sLower = item.software_name.toLowerCase();
            let isAlreadyPatched = false;
            if (sLower.includes("apache") && !sLower.includes("tomcat") && item.version === "2.4.52") isAlreadyPatched = true;
            if (sLower.includes("openssl") && item.version === "1.1.1q") isAlreadyPatched = true;
            if (sLower.includes("nginx") && item.version === "1.22.1") isAlreadyPatched = true;
            if (sLower.includes("postgres") && item.version === "12.15") isAlreadyPatched = true;
            if (sLower.includes("node") && item.version === "14.21.3") isAlreadyPatched = true;
            if (sLower.includes("tomcat") && item.version === "9.0.75") isAlreadyPatched = true;
            if (sLower.includes("glibc") && item.version === "2.35-ubuntu4") isAlreadyPatched = true;
            if (sLower.includes("cisco") && item.version === "17.3.5") isAlreadyPatched = true;
            if (sLower.includes("outlook") && item.version === "2021") isAlreadyPatched = true;
            if (sLower.includes("windows") && item.version === "10.0.17763.4377") isAlreadyPatched = true;

            if (isAlreadyPatched) {
              continue;
            }

            matchedVulnerabilities.push({
              id: nextId++,
              cve_id: cve.cve_id,
              software_name: item.software_name,
              version: item.version,
              environment: item.environment || "Production",
              hostname: item.hostname || "N/A",
              ip_address: item.ip_address || "N/A",
              owner: item.owner || "Unassigned",
              criticality: item.criticality || "Medium",
              cpe_uri: item.cpe_uri || "N/A",
              summary: `${cve.summary} [Identified via ${matchType}]`,
              cvss_score: cve.cvss_score,
              status: "Open",
              assigned_engineer: null,
              published_date: cve.published_date,
              detected_at: new Date().toISOString(),
              age_days: cve.age_days,
              impact_analysis: cve.impact_analysis,
              mitigation: cve.mitigation,
              remediation_links: cve.remediation_links,
              source: cve.source,
              is_zero_day: cve.is_zero_day
            });
          }
        }
      }

      // Broadcast completion events
      broadcast({
        event: "scan_progress",
        is_scanning: false,
        percentage: 100,
        current_cve: "Complete!"
      });
      broadcast({
        event: "vulnerabilities_updated",
        matches_found: matchedVulnerabilities.length
      });
    } else {
      const activeCve = MOCK_CVES[Math.floor(Math.random() * MOCK_CVES.length)].cve_id;
      scanProgress.percentage = currentPercentage;
      scanProgress.current_cve = `Scanning matching vectors for ${activeCve}...`;
      
      broadcast({
        event: "scan_progress",
        is_scanning: true,
        percentage: currentPercentage,
        current_cve: scanProgress.current_cve
      });
    }
  }, 200);

  res.json({ status: "success", message: "CMDB scanning started in the background." });
});

app.get("/api/v1/scan/progress", (req, res) => {
  res.json(scanProgress);
});

// 10. Assignable Engineers
app.get("/api/v1/users/assignable", (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_PATH, "utf-8"));
    const eligible = users
      .filter((u: any) => u.role === "admin" || u.role === "analyst")
      .map((u: any) => u.username);
    res.json(eligible);
  } catch (err) {
    res.json(["admin", "analyst"]);
  }
});


// WebSocket Server integration
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(msg: any) {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/ws/vulnerabilities") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});


// Vite Middleware for integrated React SPA development
async function startViteMiddleware() {
  // Pre-seed matching vulnerabilities on startup so user gets immediate visual data
  try {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
    const sources = JSON.parse(fs.readFileSync(CVE_SOURCES_PATH, "utf-8"));
    matchedVulnerabilities = [];
    let nextId = 1;

    for (const item of inventory) {
      for (const cve of MOCK_CVES) {
        const sourceKey = `${cve.source?.toLowerCase()}_enabled`;
        // skip if explicitly disabled
        if (sources[sourceKey] === false) {
          continue;
        }

        let isMatch = false;
        let matchType = "";

        // C. CPE URI Deterministic Correlation
        if (item.cpe_uri && cve.affected_cpe) {
          const itemParts = item.cpe_uri.split(":");
          const cveParts = cve.affected_cpe.split(":");
          if (itemParts.length >= 5 && cveParts.length >= 5) {
            const itemVendor = itemParts[3];
            const itemProduct = itemParts[4];
            const cveVendor = cveParts[3];
            const cveProduct = cveParts[4];
            
            if (itemVendor === cveVendor && itemProduct === cveProduct) {
              const cveVersion = cveParts[5] || "*";
              if (cveVersion === "*" || cveVersion === itemParts[5] || item.version.includes(cveVersion) || item.version === cveVersion) {
                isMatch = true;
                matchType = "CPE correlation";
              }
            }
          }
        }

        // D. Software Name Alias Match Correlation
        if (!isMatch) {
          if (areSoftwareAliases(item.software_name, cve.software_name)) {
            isMatch = true;
            matchType = "Software alias matching";
          }
        }

        // E. Fuzzy String Match Algorithm
        if (!isMatch) {
          const similarity = getStringSimilarity(item.software_name, cve.software_name);
          if (similarity >= 0.75) {
            isMatch = true;
            matchType = `Fuzzy name matching (${Math.round(similarity * 100)}% similarity)`;
          }
        }

        if (isMatch) {
          const sLower = item.software_name.toLowerCase();
          let isAlreadyPatched = false;
          if (sLower.includes("apache") && !sLower.includes("tomcat") && item.version === "2.4.52") isAlreadyPatched = true;
          if (sLower.includes("openssl") && item.version === "1.1.1q") isAlreadyPatched = true;
          if (sLower.includes("nginx") && item.version === "1.22.1") isAlreadyPatched = true;
          if (sLower.includes("postgres") && item.version === "12.15") isAlreadyPatched = true;
          if (sLower.includes("node") && item.version === "14.21.3") isAlreadyPatched = true;
          if (sLower.includes("tomcat") && item.version === "9.0.75") isAlreadyPatched = true;
          if (sLower.includes("glibc") && item.version === "2.35-ubuntu4") isAlreadyPatched = true;
          if (sLower.includes("cisco") && item.version === "17.3.5") isAlreadyPatched = true;
          if (sLower.includes("outlook") && item.version === "2021") isAlreadyPatched = true;
          if (sLower.includes("windows") && item.version === "10.0.17763.4377") isAlreadyPatched = true;

          if (isAlreadyPatched) {
            continue;
          }

          matchedVulnerabilities.push({
            id: nextId++,
            cve_id: cve.cve_id,
            software_name: item.software_name,
            version: item.version,
            environment: item.environment || "Production",
            hostname: item.hostname || "web-prod-" + nextId + ".internal",
            ip_address: item.ip_address || "10.0.1." + (10 + nextId),
            owner: item.owner || "Infrastructure",
            criticality: item.criticality || "Medium",
            cpe_uri: item.cpe_uri || "N/A",
            summary: `${cve.summary} [Identified via ${matchType}]`,
            cvss_score: cve.cvss_score,
            status: "Open",
            assigned_engineer: null,
            published_date: cve.published_date,
            detected_at: new Date().toISOString(),
            age_days: cve.age_days,
            impact_analysis: cve.impact_analysis,
            mitigation: cve.mitigation,
            remediation_links: cve.remediation_links,
            source: cve.source,
            is_zero_day: cve.is_zero_day
          });
        }
      }
    }
    scanHasRunOnce = true;
    console.log(`Initial scan complete. Pre-seeded ${matchedVulnerabilities.length} vulnerabilities.`);
  } catch (err) {
    console.error("Failed to pre-seed scan vulnerabilities on startup:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Dev Server serving on http://localhost:${PORT}`);
  });
}

startViteMiddleware();

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import * as xlsx from "xlsx";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Load or create files in inventory and root
const INVENTORY_DIR = path.join(process.cwd(), "inventory");
const INVENTORY_PATH = path.join(INVENTORY_DIR, "inventory.json");
const CVE_SOURCES_PATH = path.join(INVENTORY_DIR, "cve_sources.json");
const SCAN_SETTINGS_PATH = path.join(INVENTORY_DIR, "scan_settings.json");
const USERS_PATH = path.join(INVENTORY_DIR, "users.json");

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
    "cisco_enabled": true,
    "aruba_enabled": true
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
  "cisco ios xe": ["cisco ios xe", "cisco ios-xe", "ios xe", "ios-xe", "cisco-ios-xe"],
  "microsoft outlook": ["microsoft outlook", "outlook", "outlook 2016", "outlook 2021"],
  "windows server 2019": ["windows server", "windows server 2019", "windows", "win-server"],
  "hpe aruba switch cx 6300": ["hpe aruba switch cx 6300", "aruba switch", "aruba", "aruba cx 6300", "arubaos-cx", "arubacx", "hpe aruba"]
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

function isCveSourceEnabled(source: string, sources: any): boolean {
  if (!source) return true;
  const s = source.toLowerCase();
  if (s.includes("microsoft")) return !!sources.microsoft_enabled;
  if (s.includes("ubuntu")) return !!sources.ubuntu_enabled;
  if (s.includes("cisco")) return !!sources.cisco_enabled;
  if (s.includes("aruba") || s.includes("hpe")) return !!sources.aruba_enabled;
  // All other security feeds, including NVD, CISA KEV, OpenSSL Security Team, fall under the main feed / NVD toggle
  return sources.nvd_enabled !== undefined ? !!sources.nvd_enabled : true;
}

function areSoftwareAliases(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  if (n1 === n2) return true;
  
  // 1. Direct checking using SOFTWARE_ALIASES mapping
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
  if (prim1 === prim2) return true;

  // 2. Advanced cleaning and substring/intersection matching
  const cleanName = (n: string) => {
    return n.toLowerCase()
      .replace(/\([^)]*\)/g, "") // remove parenthetical suffixes e.g., (RHEL), (Wins), (Open JDK)
      .replace(/[^a-z0-9\s]+/g, "") // remove non-alphanumeric except spaces (e.g., .NET -> net)
      .replace(/\s+/g, " ")
      .trim();
  };

  const c1 = cleanName(name1);
  const c2 = cleanName(name2);

  if (c1 === c2 && c1.length > 0) return true;

  if (c1.length > 0 && c2.length > 0) {
    if (c1.includes(c2) || c2.includes(c1)) {
      const minLen = Math.min(c1.length, c2.length);
      // Ensure we don't map tiny/generic substrings (e.g. "for" or "app")
      if (minLen > 4) {
        return true;
      }
    }
  }
  
  return false;
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
  },
  {
    cve_id: "CVE-2023-20198",
    software_name: "Cisco IOS XE",
    summary: "Cisco IOS XE Web UI Privilege Escalation Vulnerability. Allows an unauthenticated remote attacker to create an account on an affected system with privilege level 15 access.",
    cvss_score: 10.0,
    published_date: "2023-10-16T12:00:00Z",
    age_days: 999,
    source: "Cisco",
    affected_cpe: "cpe:2.3:o:cisco:ios_xe",
    impact_analysis: "Allows full administrative takeover. Attackers can execute arbitrary command injection sequences, redirect networks, configure fake gateways, or spy on decrypted traffic streams.",
    mitigation: "Immediate Workaround: Disable the HTTP Server feature entirely by running 'no ip http server' or 'no ip http secure-server' in general configuration terminal.",
    remediation_links: ["https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-iosxe-webui-privesc-5p74YMY"]
  },
  // .NET Framework Advisories
  {
    cve_id: "CVE-2023-36042",
    software_name: ".NET Framework",
    summary: ".NET Framework Security Feature Bypass Vulnerability. Remote attackers can bypass access restrictions to execute arbitrary code.",
    cvss_score: 7.8,
    published_date: "2023-11-14T12:00:00Z",
    age_days: 967,
    source: "Microsoft",
    affected_cpe: "cpe:2.3:a:microsoft:.net_framework",
    impact_analysis: "High threat. Enables attackers to bypass internal secure deserialization constraints. This permits execution of unauthenticated payload commands under the privilege level of the running .NET application pool.",
    mitigation: "Workaround: Disable untrusted binary XML and JSON serialization streams in web.config parameters.",
    remediation_links: ["https://msrc.microsoft.com/update-guide/vulnerability/CVE-2023-36042"]
  },
  // Amazon Corretto JDK Advisories
  {
    cve_id: "CVE-2024-21011",
    software_name: "Amazon Corretto",
    summary: "OpenJDK / Amazon Corretto Information Disclosure Vulnerability in hotspot component. Allows unauthorized read/write access to runtime memory.",
    cvss_score: 7.5,
    published_date: "2024-04-16T12:00:00Z",
    age_days: 814,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:amazon:corretto",
    impact_analysis: "Enables unauthenticated remote attackers to compromise the sandbox environment of Java applications via TLS handshakes or network stream processing, leaking process memory buffers.",
    mitigation: "Workaround: Ensure strictly validated SSL/TLS cipher configs and limit incoming network sockets to trusted CIDR IP lists.",
    remediation_links: ["https://nvd.nist.gov/vuln/detail/CVE-2024-21011"]
  },
  {
    cve_id: "CVE-2022-22720",
    software_name: "Apache HTTP Server",
    summary: "Medium: LimitXMLRequestBody buffer overrun in HTTP request parsing.",
    cvss_score: 5.3,
    published_date: "2022-03-14T12:00:00Z",
    age_days: 1579,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:apache:http_server",
    impact_analysis: "An attacker could send carefully crafted large request bodies to exhaust buffer limits or trigger overflow checks, causing localized Denial of Service (DoS).",
    mitigation: "Configure 'LimitXMLRequestBody' with a strict maximum size (e.g. 512000) inside your virtual host or globally in httpd.conf.",
    remediation_links: ["https://nvd.nist.gov/vuln/detail/CVE-2022-22720", "https://httpd.apache.org/security/vulnerabilities_24.html"]
  },
  {
    cve_id: "CVE-2022-41741",
    software_name: "nginx",
    summary: "Medium: HTTP/2 HPACK memory consumption and resource exhaustion in nginx module.",
    cvss_score: 5.3,
    published_date: "2022-10-19T12:00:00Z",
    age_days: 1360,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:nginx:nginx",
    impact_analysis: "Enables unauthenticated remote attackers to exhaust memory allocations on the target nginx proxy. It bypasses conventional limits, slowing down concurrent connection servicing.",
    mitigation: "Adjust 'keepalive_requests' and 'http2_max_field_size' settings to lower threshold limits in nginx.conf.",
    remediation_links: ["https://nginx.org/en/security_advisories.html", "https://nvd.nist.gov/vuln/detail/CVE-2022-41741"]
  },
  {
    cve_id: "CVE-2020-25685",
    software_name: "PostgreSQL",
    summary: "Medium: GSSAPI transport encryption omission leading to credentials transmission fallback.",
    cvss_score: 6.5,
    published_date: "2020-11-12T12:00:00Z",
    age_days: 2066,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:postgresql:postgresql",
    impact_analysis: "A man-in-the-middle attacker could intercept the connection establishment phase and force a fallback to unencrypted transmissions, potentially exposing authenticated queries or session tokens.",
    mitigation: "Require explicit GSSAPI or SSL encryption by specifying 'hostssl' rules in your pg_hba.conf configuration and setting 'gssencmode=require'.",
    remediation_links: ["https://www.postgresql.org/support/security/", "https://nvd.nist.gov/vuln/detail/CVE-2020-25685"]
  },
  {
    cve_id: "CVE-2022-32212",
    software_name: "Node.js",
    summary: "Medium: llhttp parser multi-line header handling vulnerability allowing HTTP Request Smuggling.",
    cvss_score: 4.8,
    published_date: "2022-07-07T12:00:00Z",
    age_days: 1464,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:nodejs:node.js",
    impact_analysis: "Incomplete parsing of line-feed sequences can allow malformed headers to pass to upstream microservices, allowing an attacker to smuggle requests and bypass edge routers.",
    mitigation: "Employ strict header validation at an edge gateway (e.g. Cloudflare or AWS CloudFront) and disable HTTP Keep-Alives on untrusted internal endpoints.",
    remediation_links: ["https://nodejs.org/en/blog/vulnerability/july-2022-security-releases/"]
  },
  {
    cve_id: "CVE-2022-29885",
    software_name: "Tomcat",
    summary: "Low: Session fixation and hijacking risk via local cluster subnet multicast spoofing.",
    cvss_score: 3.3,
    published_date: "2022-06-02T12:00:00Z",
    age_days: 1499,
    source: "NVD",
    affected_cpe: "cpe:2.3:a:apache:tomcat",
    impact_analysis: "If Tomcat session replication is used on an insecure shared local subnet, local users could inject multicast messages to hijack active sessions or trigger replication loops.",
    mitigation: "Configure encrypted cluster communication using secure membership providers or set 'channelSendOptions' to separate internal VLAN networks.",
    remediation_links: ["https://tomcat.apache.org/security-9.html"]
  },
  {
    cve_id: "CVE-2021-33574",
    software_name: "glibc",
    summary: "Low: mq_notify use-after-free leading to dynamic worker thread resource leakage.",
    cvss_score: 3.7,
    published_date: "2021-05-25T12:00:00Z",
    age_days: 1863,
    source: "Ubuntu",
    affected_cpe: "cpe:2.3:a:gnu:glibc",
    impact_analysis: "A local attacker invoking message queue notifications concurrently could cause a very slow virtual memory leak inside persistent background processes.",
    mitigation: "No configurable bypass. Restrict maximum concurrent open file descriptors via system limits (ulimit -n) and restart long-running queue processes regularly.",
    remediation_links: ["https://ubuntu.com/security/CVE-2021-33574"]
  },
  {
    cve_id: "CVE-2023-46844",
    software_name: "HPE Aruba Switch CX 6300",
    summary: "Critical: HPE ArubaOS-CX Remote Code Execution. Allows unauthenticated attackers to execute arbitrary system commands as root.",
    cvss_score: 9.8,
    published_date: "2023-11-02T12:00:00Z",
    age_days: 982,
    source: "HPE Aruba",
    affected_cpe: "cpe:2.3:o:hpe:aruba_switch",
    impact_analysis: "Critical threat. Allows unauthenticated remote attackers to execute arbitrary code or CLI commands with root system privileges by sending malformed payloads to the REST API or HTTP/HTTPS daemon.",
    mitigation: "Workaround: Disable HTTP/HTTPS and REST APIs on untrusted virtual interface networks, or apply strict ACL firewalls to limit port 80/443 to management subnets.",
    remediation_links: ["https://www.arubanetworks.com/assets/support/Aruba-SR-20231102-01.txt", "https://nvd.nist.gov/vuln/detail/CVE-2023-46844"]
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
  } else if (s.includes("net framework") || s.includes(".net")) {
    verifyL = "# .NET Framework is a Windows-only component";
    mitigateL = "# Maintain patches via Windows Update / SCCM";
    verifyW = "Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full' | Get-ItemProperty -Name Release";
    mitigateW = "Install-WindowsUpdate -KB5032196 -AcceptAll -AutoReboot";
  } else if (s.includes("corretto") || s.includes("openjdk") || s.includes("java")) {
    verifyL = "java -version";
    mitigateL = "sudo apt-get update && sudo apt-get install --only-upgrade java-common -y";
    verifyW = "java -version";
    mitigateW = "choco upgrade corretto --version 21.0.12 -y";
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

    // Normalize keys to support flexible client headers with smart fallback generation
    const normalized = parsedItems.map((item: any, index: number) => {
      const normalizedItem: any = {};
      
      const keys = Object.keys(item);
      const findVal = (possibleKeys: string[], defaultVal = "") => {
        // Strip out all non-alphanumeric chars for extreme flexible comparison
        const normPossible = possibleKeys.map(pk => pk.toLowerCase().replace(/[^a-z0-9]+/g, ""));
        const foundKey = keys.find(k => {
          const normK = k.toLowerCase().replace(/[^a-z0-9]+/g, "");
          // Exact match of normalized key
          if (normPossible.includes(normK)) return true;
          // Substring checking (e.g. "hostaddress" matching "host" or "address")
          for (const pk of normPossible) {
            if (pk.length > 3 && (normK.includes(pk) || pk.includes(normK))) {
              return true;
            }
          }
          return false;
        });
        if (foundKey !== undefined && item[foundKey] !== null && item[foundKey] !== undefined) {
          const val = String(item[foundKey]).trim();
          return val === "undefined" || val === "null" || val === "" ? defaultVal : val;
        }
        return defaultVal;
      };

      normalizedItem.software_name = findVal(["softwarename", "software", "name", "softwareitem", "packagename", "package", "application", "appname", "product", "component"]);
      normalizedItem.version = findVal(["version", "ver", "softwareversion", "pkgversion", "release", "appversion", "installedversion"]);
      
      // Dynamic fallback for Environment
      const envVal = findVal(["environment", "env", "scope", "stage", "tier", "envtype"]);
      if (envVal) {
        normalizedItem.environment = envVal;
      } else {
        const envs = ["Production", "Production", "Staging", "Development"];
        normalizedItem.environment = envs[index % envs.length];
      }

      // Check if host/address can be fetched
      const rawHostVal = findVal(["hostname", "host", "ciname", "server", "machine", "vm", "device", "devicename", "assetname", "asset", "hostaddress", "address"]);
      const isIp = (str: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(str.trim());

      if (rawHostVal) {
        if (isIp(rawHostVal)) {
          normalizedItem.ip_address = rawHostVal;
          normalizedItem.hostname = `srv-${index + 100}.internal`;
        } else {
          normalizedItem.hostname = rawHostVal;
          // Generate a clean local simulated IP address
          const octet3 = Math.floor(index / 250) % 255;
          const octet4 = (100 + (index % 250)) % 255;
          normalizedItem.ip_address = `10.0.${octet3}.${octet4}`;
        }
      } else {
        const cleanSoft = normalizedItem.software_name ? normalizedItem.software_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 15) : "srv";
        normalizedItem.hostname = `srv-${cleanSoft || "app"}-${100 + index}.internal`;
        normalizedItem.ip_address = `10.0.1.${100 + (index % 150)}`;
      }

      // Dynamic fallback for Owner
      const ownerVal = findVal(["owner", "owners", "contact", "custodian", "department", "team", "managedby", "responsible", "assignedto", "user", "email"]);
      if (ownerVal) {
        normalizedItem.owner = ownerVal;
      } else {
        const owners = ["Security Operations", "Platform Infrastructure", "DevSecOps Core", "Cloud Infrastructure", "Applications Team"];
        normalizedItem.owner = owners[index % owners.length];
      }

      // Dynamic fallback for Criticality
      const critVal = findVal(["criticality", "critical", "tier", "severity", "priority", "businesscriticality"]);
      if (critVal) {
        normalizedItem.criticality = critVal;
      } else {
        const criticalities = ["High", "Medium", "High", "Critical", "Low"];
        normalizedItem.criticality = criticalities[index % criticalities.length];
      }

      // Dynamic, robust CPE auto-generation if not provided in Excel
      const cpeVal = findVal(["cpe", "cpeuri", "cpe23", "cpename"]);
      if (cpeVal) {
        normalizedItem.cpe_uri = cpeVal;
      } else if (normalizedItem.software_name) {
        const rawSoft = normalizedItem.software_name.trim().toLowerCase();
        let vendor = "generic";
        let product = rawSoft.replace(/[\s_.-]+/g, "_");
        
        // Guess vendor if name contains spaces/hyphens (e.g. "Google Chrome" -> vendor: google, product: chrome)
        const parts = rawSoft.split(/[\s_.-]+/);
        if (parts.length > 1) {
          const possibleVendor = parts[0];
          if (possibleVendor.length > 2) {
            vendor = possibleVendor;
            product = parts.slice(1).join("_");
          }
        }
        const cleanVer = normalizedItem.version ? normalizedItem.version.trim().toLowerCase().replace(/[\s_]+/g, "_") : "1.0.0";
        normalizedItem.cpe_uri = `cpe:2.3:a:${vendor}:${product}:${cleanVer}:*:*:*:*:*:*:*`;
      } else {
        normalizedItem.cpe_uri = "cpe:2.3:a:generic:generic:1.0.0:*:*:*:*:*:*:*";
      }

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

app.post("/api/v1/inventory", (req, res) => {
  try {
    const { 
      software_name, 
      version, 
      environment, 
      hostname, 
      ip_address, 
      owner, 
      criticality, 
      cpe_uri,
      // Optional lifecycle override fields
      status,
      eos_date,
      eol_date,
      last_check_date,
      source_url,
      notes,
      source_checking
    } = req.body;

    if (!software_name || !version) {
      return res.status(400).json({ error: "software_name and version are required fields." });
    }

    const records = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
    const newItem = {
      software_name,
      version,
      environment: environment || "Production",
      hostname: hostname || `srv-${records.length + 1}.internal`,
      ip_address: ip_address || `10.0.1.${10 + records.length}`,
      owner: owner || "Infrastructure Team",
      criticality: criticality || "Medium",
      cpe_uri: cpe_uri || `cpe:2.3:a:${software_name.toLowerCase().replace(/\s+/g, '_')}:${software_name.toLowerCase().replace(/\s+/g, '_')}:${version}:*:*:*:*:*:*:*`
    };

    records.push(newItem);
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(records, null, 2));

    // Handle optional EOS/EOL override if specified
    if (status || eos_date || eol_date || last_check_date || source_url || notes || source_checking) {
      const overrides = JSON.parse(fs.readFileSync(EOS_EOL_OVERRIDES_PATH, "utf-8"));
      const overrideKey = `${software_name.toLowerCase()}@${version.toLowerCase()}`;
      overrides[overrideKey] = {
        status: status || "Supported",
        eos_date: eos_date || "N/A",
        eol_date: eol_date || "N/A",
        last_check_date: last_check_date || new Date().toISOString().split('T')[0],
        source_url: source_url || "https://endoflife.io",
        notes: notes || "Manually declared lifecycle status.",
        source_checking: source_checking || "Vendor Production Support Page"
      };
      fs.writeFileSync(EOS_EOL_OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
    }

    broadcast({
      event: "inventory_updated"
    });

    res.json({ success: true, message: "Inventory asset added successfully.", item: newItem });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to add inventory asset: " + err.message });
  }
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

let geminiClient: any = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it to user secrets.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}

async function generateWithGemini(prompt: string): Promise<{ text: string; modelUsed: string } | null> {
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
  
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt
        });
        if (response && response.text) {
          return {
            text: response.text,
            modelUsed: model === "gemini-3.5-flash" ? "Gemini 3.5 Flash" : "Gemini 3.1 Flash Lite (Fallback)"
          };
        }
      } catch (err: any) {
        console.warn(`[GEMINI HELPER RETRY] Attempt ${attempt} for model ${model} failed: ${err.message || err}`);
        const isTransient = !err.status || err.status === 503 || err.status === 429 || 
                            String(err.message).includes("503") || 
                            String(err.message).includes("UNAVAILABLE") || 
                            String(err.message).includes("demand") || 
                            String(err.message).includes("fetch");
        if (attempt < 3 && isTransient) {
          const delay = attempt === 1 ? 400 : 900;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }
  }
  return null;
}

app.get("/api/v1/vulnerabilities/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const vuln = matchedVulnerabilities.find(v => v.id === id);
  if (!vuln) {
    return res.status(404).json({ detail: "Vulnerability not found" });
  }
  vuln.remediation_steps = getRemediationSteps(vuln.cve_id, vuln.software_name, vuln.version);
  res.json(vuln);
});

app.get("/api/v1/vulnerabilities/:id/ai-advisory", async (req, res) => {
  const id = parseInt(req.params.id);
  const vuln = matchedVulnerabilities.find(v => v.id === id);
  if (!vuln) {
    return res.status(404).json({ detail: "Vulnerability not found" });
  }

  const aiEngine = req.get("X-AI-Engine") || "gemini";

  const prompt = `You are an elite DevSecOps engineering copilot.
Provide a highly technical, precise remediation and patching guide for the following vulnerability:
- CVE ID: ${vuln.cve_id}
- Software Name: ${vuln.software_name}
- Installed Version: ${vuln.version}
- Affected Asset: ${vuln.hostname} (${vuln.ip_address})
- Severity Level: ${vuln.criticality}

Please structure your response into the following clear Markdown sections:

### 1. Threat Impact Analysis
Detail how an attacker exploits this flaw on this specific component and what security permissions they could obtain.

### 2. Immediate Temporary Mitigations
List configuration workarounds, firewall rule restrictions, or temporary daemon setting updates to reduce the attack surface.

### 3. Verification Commands
Provide actual terminal commands (Bash for Linux, PowerShell for Windows) to verify if the server is indeed running the vulnerable version.

### 4. Patching & Remediation Commands
Provide the precise command sequences (using apt-get, yum, docker updates, or system configuration) to fully patch and upgrade the software to a safe version.

Keep the advice practical, specific to ${vuln.software_name}, and format all code blocks beautifully.`;

  if (aiEngine === "ollama") {
    const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_MODEL || "gemma2";
    try {
      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: prompt,
          stream: false
        })
      });
      if (!response.ok) {
        throw new Error(`Ollama responded with status ${response.status}`);
      }
      const data = await response.json();
      return res.json({
        advisory: data.response,
        model_used: `Ollama (${ollamaModel})`,
        fallback: false,
        host: ollamaHost
      });
    } catch (err: any) {
      console.warn("Ollama connection failed, attempting fallback to Gemini:", err.message);
      
      try {
        const geminiResult = await generateWithGemini(prompt);
        if (geminiResult) {
          return res.json({
            advisory: geminiResult.text,
            model_used: `${geminiResult.modelUsed} (Ollama Fallback)`,
            fallback: false,
            ollama_fallback: true,
            host: ollamaHost
          });
        }
      } catch (geminiErr: any) {
        console.warn("Gemini fallback from Ollama also failed:", geminiErr.message || geminiErr);
      }

      // High-quality fallback Gemma mock response
      const fallbackAdvisory = `### [Local Ollama Fallback Engine: Gemma]
*(Note: Displayed via offline simulation because Ollama was unreachable at ${ollamaHost} and Gemini was offline. Set OLLAMA_HOST to override.)*

### 1. Threat Impact Analysis
- **Exploit Vector**: Attackers can abuse the vulnerability in **${vuln.software_name} v${vuln.version}** via specialized request payloads sent to ${vuln.hostname} (${vuln.ip_address}).
- **Local Gemma Impact Assessment**: This risk is marked as **${vuln.criticality}**. Exploitation can result in localized process crashes, privilege escalations, or unauthorized read boundaries on host containers.
- **Cost Savings Profile**: Generating this advisory locally using **Gemma** saved ~$0.00015 of cloud API fees.

### 2. Immediate Temporary Mitigations
- **Network Filtering**: Apply ingress firewall profiles to restrict traffic to ${vuln.ip_address} except from verified administrative CIDR blocks.
- **Configuration Hardening**: Minimize target processes to non-root privileges where applicable.

### 3. Verification Commands
Verify the active software binary version on **${vuln.hostname}**:
\`\`\`bash
# Linux Bash Verification command
${vuln.software_name.toLowerCase().includes("openssl") ? "openssl version" : vuln.software_name.toLowerCase().includes("nginx") ? "nginx -v" : "version_check"}
\`\`\`

### 4. Patching & Remediation Commands
Apply local containment upgrade:
\`\`\`bash
# Local Gemma Patch Guide
sudo apt-get update && sudo apt-get install --only-upgrade ${vuln.software_name.toLowerCase().includes("openssl") ? "openssl" : "apache2"} -y
\`\`\`
`;
      return res.json({
        advisory: fallbackAdvisory,
        model_used: `Local Ollama (${ollamaModel}) - Offline Fallback`,
        fallback: true,
        host: ollamaHost
      });
    }
  } else {
    // Gemini AI as primary with advanced retry, model fallback, and local resilient graceful backup
    const geminiResult = await generateWithGemini(prompt);
    if (geminiResult) {
      return res.json({
        advisory: geminiResult.text,
        model_used: geminiResult.modelUsed,
        fallback: false
      });
    } else {
      console.error("All Gemini API attempts and fallback models exhausted.");
      
      // Generate ultra high-quality, fully formatted local advisory backup
      const localBackupAdvisory = `### [Cloud API Congestion: DevSecOps Resilient Offline Advisory]
*(Note: Displayed because Google Gemini is currently experiencing a temporary spike in demand (503 Service Unavailable). Feel free to toggle the **AI Engine** in the top-right switcher to use your **Local Ollama** engine!)*

### 1. Threat Impact Analysis
- **Exploit Vector**: Attackers can abuse the vulnerability in **${vuln.software_name} v${vuln.version}** via specialized request payloads sent to **${vuln.hostname}** (${vuln.ip_address}).
- **Security Impact Assessment**: This risk is marked as **${vuln.criticality}**. Exploitation can result in localized process crashes, privilege escalations, or unauthorized read boundaries on host containers.
- **Vulnerability Details**: High likelihood of exploit availability. Since this is **${vuln.software_name}**, a secure environment update or access-control-list restriction is highly recommended immediately.

### 2. Immediate Temporary Mitigations
- **Network Filtering**: Apply ingress firewall profiles to restrict traffic to ${vuln.ip_address} except from verified administrative CIDR blocks.
- **Port Containment**: Block public external access on relevant application ports.
- **Configuration Hardening**: Ensure daemon processes run with low-privilege service accounts rather than root permissions.

### 3. Verification Commands
Verify the active software binary version on **${vuln.hostname}**:
\`\`\`bash
# Linux Bash Verification command
${vuln.software_name.toLowerCase().includes("openssl") ? "openssl version" : vuln.software_name.toLowerCase().includes("nginx") ? "nginx -v" : "version_check"}
\`\`\`

### 4. Patching & Remediation Commands
Apply local containment upgrade:
\`\`\`bash
# Local Patch Guide
sudo apt-get update && sudo apt-get install --only-upgrade ${vuln.software_name.toLowerCase().includes("openssl") ? "openssl" : "apache2"} -y
\`\`\`
`;
      return res.json({
        advisory: localBackupAdvisory,
        model_used: "DevSecOps Resilient Ruleset (API Congestion Backup)",
        fallback: false,
        gemini_fallback: true
      });
    }
  }
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
  } else if (s.includes("aruba")) {
    patchedVer = "10.10.0001";
    logs.push(`[AGENT] Initiating ArubaOS-CX TFTP upgrade protocol...`);
    logs.push(`[AGENT] Flashing secondary flash image with active OS-CX build...`);
    logs.push(`[AGENT] HPE Aruba Switch CX upgraded: ${vuln.version} -> 10.10.0001`);
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
  const { nvd_enabled, microsoft_enabled, ubuntu_enabled, cisco_enabled, aruba_enabled } = req.body;
  const config = {
    nvd_enabled: nvd_enabled !== undefined ? !!nvd_enabled : true,
    microsoft_enabled: microsoft_enabled !== undefined ? !!microsoft_enabled : true,
    ubuntu_enabled: ubuntu_enabled !== undefined ? !!ubuntu_enabled : true,
    cisco_enabled: cisco_enabled !== undefined ? !!cisco_enabled : true,
    aruba_enabled: aruba_enabled !== undefined ? !!aruba_enabled : true,
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

app.post("/api/v1/scan/reset", (req, res) => {
  const initialInventory = [
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
      "environment": "Staging",
      "hostname": "tomcat-stage-02.internal",
      "ip_address": "10.150.2.14",
      "owner": "Java Dev Team",
      "criticality": "High",
      "cpe_uri": "cpe:2.3:a:apache:tomcat:9.0.45:*:*:*:*:*:*:*"
    },
    {
      "software_name": "glibc",
      "version": "2.31-0ubuntu9",
      "environment": "Production",
      "hostname": "app-srv-02.internal",
      "ip_address": "10.140.0.18",
      "owner": "SecOps Infra",
      "criticality": "Critical",
      "cpe_uri": "cpe:2.3:a:gnu:glibc:2.31:*:*:*:*:*:*:*"
    },
    {
      "software_name": "Cisco IOS-XE",
      "version": "16.12.1a",
      "environment": "DMZ",
      "hostname": "router-core-01.internal",
      "ip_address": "10.200.10.1",
      "owner": "NetOps Core",
      "criticality": "High",
      "cpe_uri": "cpe:2.3:o:cisco:ios_xe:16.12.1a:*:*:*:*:*:*:*"
    },
    {
      "software_name": "Microsoft Outlook",
      "version": "2016",
      "environment": "User Endpoints",
      "hostname": "corp-win-102.internal",
      "ip_address": "172.16.4.102",
      "owner": "Finance Dept",
      "criticality": "Medium",
      "cpe_uri": "cpe:2.3:a:microsoft:outlook:2016:*:*:*:*:*:*:*"
    },
    {
      "software_name": "Microsoft Windows Server",
      "version": "10.0.17763.1",
      "environment": "Active Directory",
      "hostname": "ad-dc-01.internal",
      "ip_address": "10.100.0.4",
      "owner": "IT Admins",
      "criticality": "Critical",
      "cpe_uri": "cpe:2.3:o:microsoft:windows_server:10.0.17763.1:*:*:*:*:*:*:*"
    },
    {
      "software_name": "HPE Aruba Switch CX 6300",
      "version": "10.04.0001",
      "environment": "Core Switch",
      "hostname": "aruba-core-sw01.internal",
      "ip_address": "10.200.20.1",
      "owner": "NetOps Team",
      "criticality": "Critical",
      "cpe_uri": "cpe:2.3:o:hpe:aruba_switch:10.04.0001:*:*:*:*:*:*:*"
    }
  ];

  try {
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(initialInventory, null, 2));

    // Recalculate matchedVulnerabilities as unpatched
    matchedVulnerabilities = [];
    let nextId = 1;
    const sources = JSON.parse(fs.readFileSync(CVE_SOURCES_PATH, "utf-8"));

    for (const item of initialInventory) {
      for (const cve of MOCK_CVES) {
        if (!isCveSourceEnabled(cve.source, sources)) {
          continue;
        }

        let isMatch = false;
        let matchType = "";

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

        if (!isMatch && areSoftwareAliases(item.software_name, cve.software_name)) {
          isMatch = true;
          matchType = "Software alias matching";
        }

        if (!isMatch) {
          const similarity = getStringSimilarity(item.software_name, cve.software_name);
          if (similarity >= 0.75) {
            isMatch = true;
            matchType = `Fuzzy name matching (${Math.round(similarity * 100)}% similarity)`;
          }
        }

        if (isMatch) {
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

    broadcast({ event: "reseeded" });
    return res.json({ success: true, message: "Inventory database reset to default unpatched state." });
  } catch (err: any) {
    console.error("Failed to reset inventory:", err);
    return res.status(500).json({ detail: "Failed to reset inventory: " + err.message });
  }
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
          if (!isCveSourceEnabled(cve.source, sources)) {
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


// --- EOS/EOL DATABASE & API ---
const EOS_EOL_OVERRIDES_PATH = path.join(INVENTORY_DIR, "eos_eol_overrides.json");
if (!fs.existsSync(EOS_EOL_OVERRIDES_PATH)) {
  fs.writeFileSync(EOS_EOL_OVERRIDES_PATH, JSON.stringify({}, null, 2));
}

function getEosEolInfo(softwareName: string, version: string): {
  status: "Supported" | "End of Support" | "End of Life";
  eos_date: string;
  eol_date: string;
  last_check_date: string;
  source_url: string;
  notes: string;
  source_checking: string;
} {
  const name = softwareName.toLowerCase();
  
  if (name.includes("apache") && name.includes("http")) {
    if (version.startsWith("2.4")) {
      return {
        status: "Supported",
        eos_date: "N/A (Active branch)",
        eol_date: "N/A (Active branch)",
        last_check_date: "2026-07-11",
        source_url: "https://httpd.apache.org/security/vulnerabilities_24.html",
        notes: "Apache HTTPD 2.4 is the currently active stable major branch.",
        source_checking: "Vendor Production Support Page"
      };
    }
  }
  
  if (name.includes("openssl")) {
    if (version.startsWith("1.1.1")) {
      return {
        status: "End of Life",
        eos_date: "2023-09-11",
        eol_date: "2023-09-11",
        last_check_date: "2026-07-11",
        source_url: "https://www.openssl.org/blog/blog/2023/03/28/1.1.1-eol/",
        notes: "OpenSSL 1.1.1 reached official End of Life. Upgrade to 3.0.x or 3.1.x is highly recommended.",
        source_checking: "endoflife.io / Vendor support page"
      };
    }
    return {
      status: "Supported",
      eos_date: "2026-09-07",
      eol_date: "2026-09-07",
      last_check_date: "2026-07-11",
      source_url: "https://www.openssl.org/source/lifecycle.html",
      notes: "OpenSSL 3.0.x is a Long Term Support (LTS) release supported until Sept 2026.",
      source_checking: "endoflife.io / Vendor support page"
    };
  }
  
  if (name.includes("nginx")) {
    if (version.startsWith("1.18")) {
      return {
        status: "End of Life",
        eos_date: "2021-04-12",
        eol_date: "2021-04-12",
        last_check_date: "2026-07-11",
        source_url: "https://nginx.org/en/download.html",
        notes: "nginx 1.18.x legacy stable is no longer maintained. Use mainline 1.25+ or stable 1.24+.",
        source_checking: "endoflife.io / Vendor Page"
      };
    }
    return {
      status: "Supported",
      eos_date: "N/A (Active branch)",
      eol_date: "N/A (Active branch)",
      last_check_date: "2026-07-11",
      source_url: "https://nginx.org/en/download.html",
      notes: "nginx upgraded branch is active and supported.",
      source_checking: "endoflife.io / Vendor Page"
    };
  }
  
  if (name.includes("postgresql") || name.includes("postgres")) {
    if (version.startsWith("12")) {
      return {
        status: "End of Life",
        eos_date: "2024-11-14",
        eol_date: "2024-11-14",
        last_check_date: "2026-07-11",
        source_url: "https://www.postgresql.org/support/versioning/",
        notes: "PostgreSQL 12 reached End of Life on November 14, 2024. No further security patches.",
        source_checking: "endoflife.io / Vendor Page"
      };
    }
    return {
      status: "Supported",
      eos_date: "2027-11-11",
      eol_date: "2027-11-11",
      last_check_date: "2026-07-11",
      source_url: "https://www.postgresql.org/support/versioning/",
      notes: "PostgreSQL 15+ branch is actively supported.",
      source_checking: "endoflife.io / Vendor Page"
    };
  }
  
  if (name.includes("node")) {
    if (version.startsWith("14")) {
      return {
        status: "End of Life",
        eos_date: "2023-04-30",
        eol_date: "2023-04-30",
        last_check_date: "2026-07-11",
        source_url: "https://nodejs.org/en/about/previous-releases",
        notes: "Node.js 14 reached EOL on April 30, 2023. Transition to Node.js 18 or 20 LTS.",
        source_checking: "endoflife.io / Vendor Page"
      };
    }
    return {
      status: "Supported",
      eos_date: "2025-04-30",
      eol_date: "2025-04-30",
      last_check_date: "2026-07-11",
      source_url: "https://nodejs.org/en/about/previous-releases",
      notes: "Node.js 18/20 LTS are supported branches.",
      source_checking: "endoflife.io / Vendor Page"
    };
  }
  
  if (name.includes("tomcat")) {
    if (version.startsWith("9")) {
      return {
        status: "Supported",
        eos_date: "N/A (Active branch)",
        eol_date: "N/A (Active branch)",
        last_check_date: "2026-07-11",
        source_url: "https://tomcat.apache.org/tomcat-90-eol.html",
        notes: "Tomcat 9.0.x is still actively supported alongside Tomcat 10.x.",
        source_checking: "Vendor Production Support Page"
      };
    }
  }
  
  if (name.includes("glibc")) {
    return {
      status: "Supported",
      eos_date: "2025-04-30 (Standard)",
      eol_date: "2030-04-30 (Extended)",
      last_check_date: "2026-07-11",
      source_url: "https://wiki.ubuntu.com/Releases",
      notes: "Ubuntu 20.04 LTS glibc package is supported via ESM.",
      source_checking: "Ubuntu Production Support Matrix"
    };
  }
  
  if (name.includes("cisco")) {
    if (version.startsWith("16")) {
      return {
        status: "End of Life",
        eos_date: "2021-08-31",
        eol_date: "2022-08-31",
        last_check_date: "2026-07-11",
        source_url: "https://www.cisco.com/c/en/us/products/collateral/ios-nx-os-software/ios-xe-16/eos-eol-notice-c51-744358.html",
        notes: "Cisco IOS-XE 16.12.x reached EOL. Move to supported 17.x releases.",
        source_checking: "Vendor Production Support Page"
      };
    }
    return {
      status: "Supported",
      eos_date: "2026-07-31",
      eol_date: "2027-07-31",
      last_check_date: "2026-07-11",
      source_url: "https://www.cisco.com/c/en/us/products/ios-nx-os-software/ios-xe.html",
      notes: "Cisco IOS-XE 17.x is actively supported.",
      source_checking: "Vendor Production Support Page"
    };
  }
  
  if (name.includes("outlook")) {
    return {
      status: "End of Support",
      eos_date: "2020-10-13",
      eol_date: "2025-10-14",
      last_check_date: "2026-07-11",
      source_url: "https://learn.microsoft.com/en-us/lifecycle/products/outlook-2016",
      notes: "Outlook 2016 mainstream support has ended; extended security updates end Oct 2025.",
      source_checking: "Microsoft Lifecycle Support Page"
    };
  }
  
  if (name.includes("windows server")) {
    return {
      status: "End of Support",
      eos_date: "2024-01-09",
      eol_date: "2029-01-09",
      last_check_date: "2026-07-11",
      source_url: "https://learn.microsoft.com/en-us/lifecycle/products/windows-server-2019",
      notes: "Windows Server 2019 mainstream support ended in Jan 2024. Extended support continues to Jan 2029.",
      source_checking: "Microsoft Lifecycle Support Page"
    };
  }
  
  if (name.includes("aruba")) {
    if (version.startsWith("10.04")) {
      return {
        status: "End of Life",
        eos_date: "2023-11-30",
        eol_date: "2024-11-30",
        last_check_date: "2026-07-11",
        source_url: "https://www.arubanetworks.com/assets/support/HPE-Aruba-Switch-EOL.txt",
        notes: "ArubaOS-CX 10.04 reached official End of Support. Upgrade to 10.10+ recommended.",
        source_checking: "Vendor Production Support Page"
      };
    }
    return {
      status: "Supported",
      eos_date: "2027-06-30",
      eol_date: "2028-06-30",
      last_check_date: "2026-07-11",
      source_url: "https://www.arubanetworks.com/support-services/product-lifecycles/",
      notes: "ArubaOS-CX upgraded version is actively supported.",
      source_checking: "Vendor Production Support Page"
    };
  }

  return {
    status: "Supported",
    eos_date: "N/A",
    eol_date: "N/A",
    last_check_date: "2026-07-11",
    source_url: "https://www.google.com/search?q=" + encodeURIComponent(softwareName + " lifecycle"),
    notes: "No official lifecycle mapping found. Click check link to research.",
    source_checking: "endoflife.io Search fallback"
  };
}

// Get all active EOS/EOL records for current inventory items
app.get("/api/v1/eos-eol", (req, res) => {
  try {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
    const overrides = JSON.parse(fs.readFileSync(EOS_EOL_OVERRIDES_PATH, "utf-8"));

    const mapped = inventory.map((item: any, idx: number) => {
      const id = idx + 1;
      const defaultInfo = getEosEolInfo(item.software_name, item.version);
      
      const overrideKey = `${item.software_name.toLowerCase()}@${item.version.toLowerCase()}`;
      const userOverride = overrides[overrideKey] || {};

      return {
        id,
        software_name: item.software_name,
        version: item.version,
        environment: item.environment || "Production",
        status: userOverride.status || defaultInfo.status,
        eos_date: userOverride.eos_date || defaultInfo.eos_date,
        eol_date: userOverride.eol_date || defaultInfo.eol_date,
        last_check_date: userOverride.last_check_date || defaultInfo.last_check_date,
        source_url: userOverride.source_url || defaultInfo.source_url,
        notes: userOverride.notes || defaultInfo.notes,
        source_checking: userOverride.source_checking || defaultInfo.source_checking || "endoflife.io / Vendor Page"
      };
    });

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load EOS/EOL tracker records: " + err.message });
  }
});

// Update an override inside the same database server
app.post("/api/v1/eos-eol/override", (req, res) => {
  try {
    const { software_name, version, status, eos_date, eol_date, last_check_date, source_url, notes, source_checking } = req.body;
    if (!software_name || !version) {
      return res.status(400).json({ error: "software_name and version parameters are required." });
    }

    const overrides = JSON.parse(fs.readFileSync(EOS_EOL_OVERRIDES_PATH, "utf-8"));
    const overrideKey = `${software_name.toLowerCase()}@${version.toLowerCase()}`;

    overrides[overrideKey] = {
      status,
      eos_date,
      eol_date,
      last_check_date,
      source_url,
      notes,
      source_checking: source_checking || "Vendor Production Support Page"
    };

    fs.writeFileSync(EOS_EOL_OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
    
    broadcast({
      event: "inventory_updated"
    });

    res.json({ success: true, message: "Lifecycle registry updated successfully inside server database." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update lifecycle details: " + err.message });
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
        // skip if explicitly disabled
        if (!isCveSourceEnabled(cve.source, sources)) {
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

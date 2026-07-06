# Getting Started Guide

This guide describes how to operate the **Security Advisory Tracker** from first setup to scanning, analysis, and report distribution.

## 1. Software Inventory Management

The application loads software inventories from the `/inventory/` directory.

### Supported File Formats
You can drop three file formats into this directory:
- `inventory.json`
- `inventory.xlsx` (Excel Spreadsheet)
- `inventory.csv` (Comma Separated Values)

### Rules of Precedence
1. **Newest File Wins**: The bootstrap and ingestion services look at the modification timestamps of the files in `/inventory/`. The newest file always takes precedence.
2. **Auto-Conversion**: If an `xlsx` or `csv` file has been updated more recently than the existing `inventory.json` file, the system automatically parses and overwrites `inventory.json` on boot or manual ingestion.
3. **Record Properties**: Every row must define the following columns:
   - **Software Name** (required): Matches against CVE vendor and product names.
   - **Version** (required): Version tracking (e.g. `2.4.48`, `1.1.1k`).
   - **Environment** (optional, defaults to `Production`): Used to scope asset environments (e.g., `Production`, `Staging`, `Development`).

## 2. Triggering Scans

### Zero-Vulnerability Default
By default, the active vulnerability table displays **zero rows**. This prevents noisy, incomplete dashboards from populating before parameters are checked.
To show matches:
- **Auto-Scan Lookup**: Toggle the *Continuous 24h Scan* switch in the CMDB panel and select either a 7-day or 14-day window. This triggers a matching run against recent CVE records.
- **Manual Scan**: Click the **Scan CMDB Now** button. A WebSocket-fueled progress bar tracks matching accuracy and loads findings into the dashboard.

## 3. Vulnerability Analysis Workflow

### A. Triage and Assignments
An analyst or admin can quickly filter vulnerabilities by:
- Keyword searches (CVE ID or Software Name)
- Severities (Critical/High/Medium/Low)
- Publishing ages (Min/Max days ago)

They can then assign individual compliance issues to specific security engineers from the dropdown and update the status:
- **Open**: Active and needs mitigation.
- **False Positive**: Confirmed non-applicable matching or sandbox-only warning.
- **Mitigated**: Remediated, patched, or isolated.

### B. Accessing Remediation Scripts
Expanding any vulnerability row opens detailed, platform-specific technical remediation instructions:
- **Linux / Bash**: Commands to check versions and apply patches via standard apt/yum packagers.
- **Windows / PowerShell**: Commands to inspect file system registers and run MSI/unattended package installers silently.

### C. Spreadsheet Exports
Check the rows you wish to report, and click the **Export selected rows** action button. This generates a perfectly formatted spreadsheet-compatible CSV containing your current triage logs, engineer owners, and severity details.

# Component Documentation

The application's logic is modularized across clear, specialized files. Here is a catalog of the architectural components implemented:

## Frontend Components (React + Vite)

### 1. `App.tsx`
- **Location**: `/src/App.tsx`
- **Responsibility**: Checks local storage for active authentication tokens. Routes unauthenticated visitors to the `LoginForm`, and verified operators to the `Dashboard`.

### 2. `LoginForm.tsx`
- **Location**: `/src/components/LoginForm.tsx`
- **Responsibility**: Provides input fields, handles password visibility toggles, and features quick-credential quick buttons for sandbox testing (Admin, Analyst, and Viewer roles).

### 3. `Dashboard.tsx`
- **Location**: `/src/components/Dashboard.tsx`
- **Responsibility**: Main application interface. Orchestrates WebSocket subscriptions, updates metric cards dynamically, and handles view changes (Dashboard Grid vs. Master CMDB Inventory).

### 4. `CmdbScanPanel.tsx`
- **Location**: `/src/components/CmdbScanPanel.tsx`
- **Responsibility**: Manages CMDB lookup settings. Provides a mutually exclusive 7 vs 14-day window selector, an optional single CVE ID trigger, a manual scanning initiator, and a live green progress bar fed by WebSocket events.

### 5. `CveSourcesPanel.tsx`
- **Location**: `/src/components/CveSourcesPanel.tsx`
- **Responsibility**: Toggle block allowing analysts or administrators to quickly enable or disable external CVE sync crawls (re-writing `cve_sources.json`).

### 6. `VulnerabilityGrid.tsx`
- **Location**: `/src/components/VulnerabilityGrid.tsx`
- **Responsibility**: High-density data grid with deep filters (search, status, severity, CVE age). Supports row selection, bulk exports to Excel/CSV, inline engineer assignment dropdowns, status changes, and collapsible technical remediation panels.

### 7. `InventoryGrid.tsx`
- **Location**: `/src/components/InventoryGrid.tsx`
- **Responsibility**: Scrollable listing of all master software inventory elements currently synced into the database, with a manual file-ingestion trigger button.

---

## Backend Services (FastAPI / Express Mock)

### 1. `inventory_source.py`
- **Location**: `/backend/app/services/inventory_source.py`
- **Responsibility**: Finds files in `/inventory/` and executes pandas-driven XLSX/CSV-to-JSON parsing if modern modifications exist.

### 2. `inventory_ingestion.py`
- **Location**: `/backend/app/services/inventory_ingestion.py`
- **Responsibility**: Performs isolated database transactions to keep the database fully synchronized with the parsed master file.

### 3. `cve_sync.py`
- **Location**: `/backend/app/services/cve_sync.py`
- **Responsibility**: Syncs CVE entries from the NIST NVD API 2.0. If network or timeout failures occur, falls back to a high-fidelity mock list to guarantee a functioning workspace.

### 4. `cmdb_scan.py`
- **Location**: `/backend/app/services/cmdb_scan.py`
- **Responsibility**: Runs matching loops, calculates fuzzy name scores, generates custom remediation plans, and publishes progress statistics to active WebSocket sockets.

### 5. `match_scoring.py`
- **Location**: `/backend/app/services/match_scoring.py`
- **Responsibility**: Clean deterministic string and substring scoring engine supporting common software aliases.

### 6. `remediation.py`
- **Location**: `/backend/app/services/remediation.py`
- **Responsibility**: Compiles step-by-step verification and patching commands for both Linux (bash) and Windows (PowerShell) based on matched vendor fields.

### 7. `report_export.py`
- **Location**: `/backend/app/services/report_export.py`
- **Responsibility**: Compiles targeted vulnerability indexes into clean, standard-conforming spreadsheets.

---

## WebSocket Events Matrix

Clients connect to `ws://localhost:3000/ws/vulnerabilities` and receive JSON frames.

| Event Type | Payload Attributes | Triggered By | Client Action |
| :--- | :--- | :--- | :--- |
| `scan_progress` | `is_scanning: bool`, `percentage: int`, `current_cve: str` | Scan status changes and matching loop increments | Updates the dashboard progress bar and status subtitles |
| `vulnerabilities_updated` | `matches_found: int` | Match run finishing | Forces the vulnerability table to re-query the backend |
| `status_changed` | `vulnerability_id: int`, `status: str`, `assigned_engineer: str` | Patch action or engineer assignment | Re-syncs stats metrics and grid line properties |

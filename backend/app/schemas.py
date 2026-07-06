from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

# Auth
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

# Inventory
class InventoryItemBase(BaseModel):
    software_name: str
    version: str
    environment: Optional[str] = "Production"

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemResponse(InventoryItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Vulnerabilities
class VulnerabilityResponse(BaseModel):
    id: int
    cve_id: str
    software_id: int
    software_name: str
    version: str
    environment: str
    summary: str
    cvss_score: Optional[Decimal] = None
    status: str
    assigned_engineer: Optional[str] = None
    published_date: datetime
    detected_at: datetime

    class Config:
        from_attributes = True

class VulnerabilityDetailResponse(VulnerabilityResponse):
    remediation_steps: Optional[str] = None

class VulnerabilityStatusUpdate(BaseModel):
    status: Optional[str] = None
    assigned_engineer: Optional[str] = None

class SelectedExportRequest(BaseModel):
    ids: List[int]

# Sources / Settings
class CveSourcesConfig(BaseModel):
    nvd_enabled: bool

class ScanSettingsConfig(BaseModel):
    auto_scan: bool
    scan_window_days: int

class ScanCmdbRequest(BaseModel):
    cve_id: Optional[str] = None

# Stats
class DashboardStats(BaseModel):
    inventory_count: int
    open_vulns_count: int
    high_critical_count: int
    total_matches_count: int

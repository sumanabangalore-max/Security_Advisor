from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import io

from ..database import get_db
from .. import models, schemas, auth
from ..websocket_manager import manager
from ..services.cve_source_registry import read_cve_sources, write_cve_sources
from ..services.scan_settings_registry import read_scan_settings, write_scan_settings
from ..services.inventory_source import resolve_inventory
from ..services.inventory_ingestion import ingest_inventory_records
from ..services.vulnerability_filters import get_filtered_vulnerabilities
from ..services.cmdb_scan import run_cmdb_scan_async
from ..services.scan_progress import tracker
from ..services.remediation import generate_remediation
from ..services.report_export import export_vulnerabilities_to_excel

router = APIRouter()

# 1. Auth Endpoint
@router.post("/auth/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not auth.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    access_token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

# 2. Stats
@router.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    inventory_count = db.query(models.MasterInventory).count()
    
    # Check if scan settings auto_scan is on or matches exist
    settings = read_scan_settings()
    has_matches = db.query(models.VulnerabilityLifecycle).count() > 0
    
    if not settings.get("auto_scan", False) and not has_matches:
        return {
            "inventory_count": inventory_count,
            "open_vulns_count": 0,
            "high_critical_count": 0,
            "total_matches_count": 0
        }

    open_vulns_count = db.query(models.VulnerabilityLifecycle).filter(models.VulnerabilityLifecycle.status == "Open").count()
    
    high_critical_count = db.query(models.VulnerabilityLifecycle).join(
        models.LiveCVE, models.VulnerabilityLifecycle.cve_id == models.LiveCVE.cve_id
    ).filter(
        models.VulnerabilityLifecycle.status == "Open",
        models.LiveCVE.cvss_score >= 7.0
    ).count()

    total_matches_count = db.query(models.VulnerabilityLifecycle).count()

    return {
        "inventory_count": inventory_count,
        "open_vulns_count": open_vulns_count,
        "high_critical_count": high_critical_count,
        "total_matches_count": total_matches_count
    }

# 3. Inventory API
@router.get("/inventory", response_model=List[schemas.InventoryItemResponse])
def get_inventory(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return db.query(models.MasterInventory).all()

@router.post("/inventory/ingest")
def manual_ingest(db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["admin", "analyst"]))):
    try:
        records = resolve_inventory()
        if records:
            ingest_inventory_records(db, records)
            return {"status": "success", "message": f"Successfully ingested {len(records)} items."}
        else:
            return {"status": "success", "message": "No inventory files found to ingest."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest failed: {str(e)}")

# 4. Vulnerability List
@router.get("/vulnerabilities")
def get_vulnerabilities(
    search: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    page: int = 1,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    results, total = get_filtered_vulnerabilities(
        db, search, status, severity, min_age, max_age, page, limit
    )
    return {
        "vulnerabilities": results,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/vulnerabilities/{id}", response_model=schemas.VulnerabilityDetailResponse)
def get_vulnerability_detail(id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Query lifecycle
    item = db.query(models.VulnerabilityLifecycle).filter(models.VulnerabilityLifecycle.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vulnerability match not found")
        
    cve = db.query(models.LiveCVE).filter(models.LiveCVE.cve_id == item.cve_id).first()
    inv = db.query(models.MasterInventory).filter(models.MasterInventory.id == item.software_id).first()
    
    # Lazy build remediation if not present
    steps = item.remediation_steps
    if not steps:
        steps = generate_remediation(cve.cve_id, inv.software_name, inv.version)
        item.remediation_steps = steps
        db.commit()

    return {
        "id": item.id,
        "cve_id": item.cve_id,
        "software_id": item.software_id,
        "software_name": inv.software_name,
        "version": inv.version,
        "environment": inv.environment,
        "summary": cve.summary,
        "cvss_score": cve.cvss_score,
        "status": item.status,
        "assigned_engineer": item.assigned_engineer,
        "published_date": cve.published_date,
        "detected_at": item.detected_at,
        "remediation_steps": steps
    }

@router.patch("/vulnerabilities/{id}/status", response_model=schemas.VulnerabilityResponse)
def update_vulnerability_status(
    id: int, 
    payload: schemas.VulnerabilityStatusUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.RoleChecker(["admin", "analyst"]))
):
    item = db.query(models.VulnerabilityLifecycle).filter(models.VulnerabilityLifecycle.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Vulnerability not found")

    if payload.status is not None:
        if payload.status not in ["Open", "False Positive", "Mitigated"]:
            raise HTTPException(status_code=400, detail="Invalid status value")
        item.status = payload.status

    if payload.assigned_engineer is not None:
        item.assigned_engineer = payload.assigned_engineer

    db.commit()
    
    cve = db.query(models.LiveCVE).filter(models.LiveCVE.cve_id == item.cve_id).first()
    inv = db.query(models.MasterInventory).filter(models.MasterInventory.id == item.software_id).first()

    # Trigger WS broadcast on status change
    import asyncio
    asyncio.run(manager.broadcast({
        "event": "status_changed",
        "vulnerability_id": item.id,
        "status": item.status,
        "assigned_engineer": item.assigned_engineer
    }))

    return {
        "id": item.id,
        "cve_id": item.cve_id,
        "software_id": item.software_id,
        "software_name": inv.software_name,
        "version": inv.version,
        "environment": inv.environment,
        "summary": cve.summary,
        "cvss_score": cve.cvss_score,
        "status": item.status,
        "assigned_engineer": item.assigned_engineer,
        "published_date": cve.published_date,
        "detected_at": item.detected_at
    }

# 5. Excel Export
@router.post("/vulnerabilities/export")
def export_vulnerabilities(payload: schemas.SelectedExportRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    query = db.query(
        models.VulnerabilityLifecycle.id,
        models.VulnerabilityLifecycle.cve_id,
        models.MasterInventory.software_name,
        models.MasterInventory.version,
        models.MasterInventory.environment,
        models.LiveCVE.cvss_score,
        models.VulnerabilityLifecycle.status,
        models.VulnerabilityLifecycle.assigned_engineer,
        models.LiveCVE.published_date,
        models.VulnerabilityLifecycle.detected_at
    ).join(
        models.LiveCVE, models.VulnerabilityLifecycle.cve_id == models.LiveCVE.cve_id
    ).join(
        models.MasterInventory, models.VulnerabilityLifecycle.software_id == models.MasterInventory.id
    )

    if payload.ids:
        query = query.filter(models.VulnerabilityLifecycle.id.in_(payload.ids))
        
    results = query.all()
    vuln_dicts = []
    for r in results:
        vuln_dicts.append({
            "cve_id": r.cve_id,
            "software_name": r.software_name,
            "version": r.version,
            "environment": r.environment,
            "cvss_score": float(r.cvss_score) if r.cvss_score is not None else None,
            "status": r.status,
            "assigned_engineer": r.assigned_engineer,
            "published_date": r.published_date,
            "detected_at": r.detected_at
        })

    excel_bytes = export_vulnerabilities_to_excel(vuln_dicts)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=vulnerability_report.xlsx"}
    )

# 6. CVE Sources
@router.get("/cve-sources", response_model=schemas.CveSourcesConfig)
def get_cve_sources(current_user: models.User = Depends(auth.get_current_user)):
    return read_cve_sources()

@router.patch("/cve-sources", response_model=schemas.CveSourcesConfig)
def update_cve_sources(payload: schemas.CveSourcesConfig, current_user: models.User = Depends(auth.RoleChecker(["admin", "analyst"]))):
    config = {"nvd_enabled": payload.nvd_enabled}
    write_cve_sources(config)
    return config

# 7. Scan Settings
@router.get("/scan/settings", response_model=schemas.ScanSettingsConfig)
def get_scan_settings(current_user: models.User = Depends(auth.get_current_user)):
    return read_scan_settings()

@router.patch("/scan/settings", response_model=schemas.ScanSettingsConfig)
def update_scan_settings(payload: schemas.ScanSettingsConfig, current_user: models.User = Depends(auth.RoleChecker(["admin", "analyst"]))):
    config = {
        "auto_scan": payload.auto_scan,
        "scan_window_days": payload.scan_window_days
    }
    write_scan_settings(config)
    return config

# 8. Start Scan
@router.post("/scan/cmdb")
def start_scan(payload: schemas.ScanCmdbRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(auth.RoleChecker(["admin", "analyst"]))):
    if tracker.is_scanning:
        raise HTTPException(status_code=400, detail="A scan is already in progress.")
    
    # We trigger the scan in the background to prevent blocking the API
    background_tasks.add_task(run_cmdb_scan_async, db, payload.cve_id)
    return {"status": "success", "message": "CMDB scanning started in the background."}

@router.get("/scan/progress")
def get_scan_progress(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "is_scanning": tracker.is_scanning,
        "percentage": tracker.percentage,
        "current_cve": tracker.current_cve
    }

# 9. Assignable Engineers
@router.get("/users/assignable", response_model=List[str])
def get_assignable_engineers(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Analysts and admins can be assigned
    users = db.query(models.User.username).filter(models.User.role.in_(["admin", "analyst"])).all()
    return [u.username for u in users]

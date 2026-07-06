import time
import asyncio
from sqlalchemy.orm import Session
from ..models import MasterInventory, LiveCVE, VulnerabilityLifecycle
from .match_analyzer import analyze_match_confidence
from .remediation import generate_remediation
from .scan_progress import tracker
from ..websocket_manager import manager

async def run_cmdb_scan_async(db: Session, single_cve_id: str = None):
    """
    Asynchronous CMDB scanning that updates WebSocket clients with real-time percentage progress.
    """
    tracker.start_scan()
    
    # Send start event
    await manager.broadcast({
        "event": "scan_progress",
        "is_scanning": True,
        "percentage": 0,
        "current_cve": "Initializing..."
    })

    try:
        # Fetch inventory
        inventory = db.query(MasterInventory).all()
        
        # Fetch CVEs
        cve_query = db.query(LiveCVE)
        if single_cve_id:
            cve_query = cve_query.filter(LiveCVE.cve_id == single_cve_id)
        cves = cve_query.all()

        total_steps = len(cves)
        matches_found = 0

        if total_steps == 0:
            tracker.update_progress(100)
            await manager.broadcast({
                "event": "scan_progress",
                "is_scanning": False,
                "percentage": 100,
                "current_cve": "No CVEs to scan."
            })
            tracker.end_scan()
            return 0

        for idx, cve in enumerate(cves):
            # Update progress
            percentage = int(((idx + 1) / total_steps) * 100)
            tracker.update_progress(percentage, cve.cve_id)
            
            # Broadcast progress
            await manager.broadcast({
                "event": "scan_progress",
                "is_scanning": True,
                "percentage": percentage,
                "current_cve": f"Scanning {cve.cve_id}..."
            })

            # Match with inventory items
            for inv_item in inventory:
                confidence, level = analyze_match_confidence(
                    inv_item.software_name,
                    inv_item.version,
                    cve.software_name,
                    cve.version_affected
                )

                if confidence >= 0.6:  # Match found (Medium or High confidence)
                    # Check if already matched
                    existing_match = db.query(VulnerabilityLifecycle).filter(
                        VulnerabilityLifecycle.cve_id == cve.cve_id,
                        VulnerabilityLifecycle.software_id == inv_item.id
                    ).first()

                    if not existing_match:
                        # Create remediation
                        remediation_text = generate_remediation(
                            cve.cve_id,
                            inv_item.software_name,
                            inv_item.version
                        )

                        new_match = VulnerabilityLifecycle(
                            cve_id=cve.cve_id,
                            software_id=inv_item.id,
                            status="Open",
                            assigned_engineer=None,
                            remediation_steps=remediation_text
                        )
                        db.add(new_match)
                        matches_found += 1
            
            db.commit()
            # Yield control briefly to simulate async progress and prevent event loop starvation
            await asyncio.sleep(0.1)

        tracker.end_scan()
        
        # Broadcast completed and trigger dashboard reload
        await manager.broadcast({
            "event": "scan_progress",
            "is_scanning": False,
            "percentage": 100,
            "current_cve": "Complete!"
        })
        
        await manager.broadcast({
            "event": "vulnerabilities_updated",
            "matches_found": matches_found
        })

        return matches_found

    except Exception as e:
        db.rollback()
        tracker.end_scan()
        await manager.broadcast({
            "event": "scan_progress",
            "is_scanning": False,
            "percentage": 100,
            "current_cve": f"Error: {str(e)}"
        })
        raise e

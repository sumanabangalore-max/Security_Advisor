import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal, Base
from .api.routes import router as api_router
from .websocket_manager import manager
from .services.data_bootstrap import bootstrap_inventory_data
from .services.cve_sync import sync_cves_from_nvd

app = FastAPI(title="Security Advisory Tracker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(api_router, prefix="/api/v1")

# Health check (unauthenticated)
@app.get("/health/data")
def health_data():
    db = SessionLocal()
    try:
        # Check if inventory has any software loaded
        from .models import MasterInventory
        count = db.query(MasterInventory).count()
        return {"ready": True, "inventory_loaded": count > 0, "count": count}
    except Exception as e:
        return {"ready": False, "error": str(e)}
    finally:
        db.close()

# WebSocket for progress and live alerts
@app.websocket("/ws/vulnerabilities")
async def websocket_vulnerabilities(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We keep the connection alive, reading any messages sent by client (if any)
            data = await websocket.receive_text()
            # Just echo or handle messages if needed, normally client just listens
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# Non-blocking database bootstrap task
async def non_blocking_startup_bootstrap():
    print("Starting background non-blocking bootstrap task...")
    await asyncio.sleep(1) # wait 1 second for app to start listening
    db = SessionLocal()
    try:
        # Initialize tables
        Base.metadata.create_all(bind=engine)
        
        # Bootstrap inventory
        bootstrap_inventory_data(db)
        
        # Prefetch CVEs (sync NVD or seeds)
        sync_cves_from_nvd(db)
        print("Startup bootstrap successfully completed!")
    except Exception as e:
        print(f"Startup bootstrap failed: {e}")
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    # Execute startup task in a background thread or async task so it doesn't block FastAPI startup
    asyncio.create_task(non_blocking_startup_bootstrap())

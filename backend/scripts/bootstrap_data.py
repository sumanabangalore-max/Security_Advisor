import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app.services.inventory_source import resolve_inventory
from app.services.inventory_ingestion import ingest_inventory_records

def run_bootstrap():
    print("Bootstrap: Initializing database schema...")
    Base.metadata.create_all(bind=engine)

    print("Bootstrap: Resolving and ingesting master software inventory...")
    db = SessionLocal()
    try:
        records = resolve_inventory()
        if records:
            ingest_inventory_records(db, records)
            print(f"Bootstrap SUCCESS: Ingested {len(records)} inventory records.")
        else:
            print("Bootstrap: No inventory records found to ingest.")
    except Exception as e:
        print(f"Bootstrap ERROR: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_bootstrap()

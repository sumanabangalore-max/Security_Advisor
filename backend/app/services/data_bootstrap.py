from sqlalchemy.orm import Session
from .inventory_source import resolve_inventory
from .inventory_ingestion import ingest_inventory_records

def bootstrap_inventory_data(db: Session):
    try:
        records = resolve_inventory()
        if records:
            ingest_inventory_records(db, records)
            print(f"Successfully bootstrapped {len(records)} inventory records.")
        else:
            print("No inventory records found during bootstrap.")
    except Exception as e:
        print(f"Error during inventory bootstrapping: {e}")

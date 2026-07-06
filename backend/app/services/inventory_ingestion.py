from sqlalchemy.orm import Session
from ..models import MasterInventory

def ingest_inventory_records(db: Session, records: list[dict]):
    # Use a separate database transaction for inventory sync
    try:
        # Create a set of keys in the incoming file for matching (software_name + version)
        incoming_keys = set()
        incoming_dict = {}
        
        for r in records:
            name = str(r.get("software_name", "")).strip()
            version = str(r.get("version", "1.0.0")).strip()
            env = str(r.get("environment", "Production")).strip()
            if not env:
                env = "Production"
                
            if not name:
                continue
                
            key = (name.lower(), version.lower())
            incoming_keys.add(key)
            incoming_dict[key] = {
                "software_name": name,
                "version": version,
                "environment": env
            }

        # Fetch existing items from db
        existing_items = db.query(MasterInventory).all()
        existing_keys = {}
        for item in existing_items:
            key = (item.software_name.lower(), item.version.lower())
            existing_keys[key] = item

        # 1. Update existing and Insert new
        for key, data in incoming_dict.items():
            if key in existing_keys:
                # Update environment if changed
                item = existing_keys[key]
                if item.environment != data["environment"]:
                    item.environment = data["environment"]
            else:
                # Insert new item
                new_item = MasterInventory(
                    software_name=data["software_name"],
                    version=data["version"],
                    environment=data["environment"]
                )
                db.add(new_item)

        # 2. Delete items no longer in the file
        for key, item in existing_keys.items():
            if key not in incoming_keys:
                db.delete(item)

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        raise e

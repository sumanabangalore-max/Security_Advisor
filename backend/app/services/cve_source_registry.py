import os
import json

INVENTORY_DIR = os.getenv("INVENTORY_DIR")
if not INVENTORY_DIR:
    if os.path.exists("/app/inventory"):
        INVENTORY_DIR = "/app/inventory"
    else:
        INVENTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "inventory")

CONFIG_PATH = os.path.join(INVENTORY_DIR, "cve_sources.json")

def read_cve_sources() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Return default if missing or invalid
    return {"nvd_enabled": True}

def write_cve_sources(config: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

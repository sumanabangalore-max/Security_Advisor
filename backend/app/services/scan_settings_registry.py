import os
import json

INVENTORY_DIR = os.getenv("INVENTORY_DIR")
if not INVENTORY_DIR:
    if os.path.exists("/app/inventory"):
        INVENTORY_DIR = "/app/inventory"
    else:
        INVENTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "inventory")

CONFIG_PATH = os.path.join(INVENTORY_DIR, "scan_settings.json")

def read_scan_settings() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"auto_scan": False, "scan_window_days": 7}

def write_scan_settings(config: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

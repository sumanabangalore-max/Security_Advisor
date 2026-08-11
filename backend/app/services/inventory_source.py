import os
import pandas as pd
import json
from typing import Optional

INVENTORY_DIR = os.getenv("INVENTORY_DIR")
if not INVENTORY_DIR:
    if os.path.exists("/app/inventory"):
        INVENTORY_DIR = "/app/inventory"
    else:
        INVENTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "inventory")

def get_newest_inventory_file() -> tuple[Optional[str], Optional[str]]:
    if not os.path.exists(INVENTORY_DIR):
        os.makedirs(INVENTORY_DIR, exist_ok=True)
        return None, None

    system_files = {
        "ai_config.json",
        "cve_sources.json",
        "db_config.json",
        "email_logs.json",
        "eos_eol_overrides.json",
        "forwarded_logs.json",
        "jump_hosts.json",
        "ldap_config.json",
        "logging_config.json",
        "patch_schedule.json",
        "scan_settings.json",
        "smtp_settings.json",
        "users.json"
    }

    files = []
    for f in os.listdir(INVENTORY_DIR):
        if f in system_files or f.endswith(("_config.json", "_settings.json", "_logs.json", "_schedule.json", "_hosts.json")):
            continue
        if f.endswith(('.json', '.xlsx', '.csv')):
            files.append(os.path.join(INVENTORY_DIR, f))

    if not files:
        return None, None

    # Get the file with the newest modification time
    newest_file = max(files, key=os.path.getmtime)
    ext = os.path.splitext(newest_file)[1].lower()
    return newest_file, ext

def convert_to_json(source_file: str, ext: str) -> str:
    target_json = os.path.join(INVENTORY_DIR, "inventory.json")
    
    if ext == ".json":
        return source_file

    # Load file with pandas
    if ext == ".xlsx":
        df = pd.read_excel(source_file)
    elif ext == ".csv":
        df = pd.read_csv(source_file)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    # Standardize column headers
    # Expected: Software Name, Version, Environment (default 'Production')
    col_mapping = {}
    for col in df.columns:
        col_lower = str(col).lower().replace("_", " ").strip()
        if "software" in col_lower or "name" in col_lower:
            col_mapping[col] = "software_name"
        elif "version" in col_lower or "ver" in col_lower:
            col_mapping[col] = "version"
        elif "env" in col_lower:
            col_mapping[col] = "environment"

    df = df.rename(columns=col_mapping)
    
    # Check required columns
    if "software_name" not in df.columns:
         df["software_name"] = df.iloc[:, 0] if len(df.columns) > 0 else "Unknown Software"
    if "version" not in df.columns:
         df["version"] = df.iloc[:, 1] if len(df.columns) > 1 else "1.0.0"
    if "environment" not in df.columns:
         df["environment"] = "Production"

    # Fill NaNs
    df["software_name"] = df["software_name"].fillna("Unknown Software")
    df["version"] = df["version"].fillna("1.0.0").astype(str)
    df["environment"] = df["environment"].fillna("Production")

    # Select only required columns
    clean_df = df[["software_name", "version", "environment"]]
    
    # Save to JSON
    records = clean_df.to_dict(orient="records")
    with open(target_json, "w") as f:
        json.dump(records, f, indent=2)

    return target_json

def resolve_inventory() -> list[dict]:
    newest, ext = get_newest_inventory_file()
    json_path = os.path.join(INVENTORY_DIR, "inventory.json")

    if newest and newest != json_path:
        if not os.path.exists(json_path) or os.path.getmtime(newest) > os.path.getmtime(json_path):
            try:
                converted = convert_to_json(newest, ext)
                if converted:
                    json_path = converted
            except Exception as e:
                print(f"Warning: Failed to convert {newest} to json: {e}")

    if os.path.exists(json_path):
        try:
            with open(json_path, "r") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return [r for r in data if isinstance(r, dict)]
                elif isinstance(data, dict):
                    for key in ["inventory", "records", "data", "items"]:
                        if key in data and isinstance(data[key], list):
                            return [r for r in data[key] if isinstance(r, dict)]
        except Exception as e:
            print(f"Error reading inventory json: {e}")

    return []

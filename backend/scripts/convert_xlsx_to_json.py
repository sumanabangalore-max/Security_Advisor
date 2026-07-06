import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.inventory_source import resolve_inventory

def run_conversion():
    print("Converting XLS/XLSX/CSV to JSON in the inventory folder...")
    try:
        records = resolve_inventory()
        if records:
            print(f"Conversion complete! inventory.json updated with {len(records)} records.")
        else:
            print("No source files found to convert.")
    except Exception as e:
        print(f"Conversion failed: {e}")

if __name__ == "__main__":
    run_conversion()

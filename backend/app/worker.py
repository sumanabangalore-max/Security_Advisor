import time
import os
from sqlalchemy.orm import Session
from database import SessionLocal
from services.cve_sync import sync_cves_from_nvd

def main_worker_loop():
    print("Background worker started. CVE sync interval: 24 hours.")
    while True:
        db = SessionLocal()
        try:
            print("Worker: Executing scheduled 24-hour CVE synchronization...")
            seeded_or_fetched = sync_cves_from_nvd(db)
            print(f"Worker: Successfully synchronized {seeded_or_fetched} CVE records.")
        except Exception as e:
            print(f"Worker Error during CVE sync: {e}")
        finally:
            db.close()

        # Sleep for 24 hours (86400 seconds)
        print("Worker: Sleeping for 24 hours...")
        time.sleep(86400)

if __name__ == "__main__":
    main_worker_loop()

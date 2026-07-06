from datetime import datetime, timezone

def calculate_cve_age_days(published_date: datetime) -> int:
    if not published_date:
        return 0
    # Ensure published_date is timezone-aware
    if published_date.tzinfo is None:
        published_date = published_date.replace(tzinfo=timezone.utc)
    
    now = datetime.now(timezone.utc)
    delta = now - published_date
    return max(0, delta.days)

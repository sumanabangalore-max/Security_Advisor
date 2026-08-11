import io
from datetime import datetime
import pandas as pd

def export_vulnerabilities_to_excel(vulnerabilities: list) -> bytes:
    """
    Exports a list of vulnerability objects/dicts to Excel binary bytes.
    """
    data = []
    for v in vulnerabilities:
        get_val = lambda key, default=None: v.get(key, default) if isinstance(v, dict) else getattr(v, key, default)
        pub_date = get_val("published_date")
        det_date = get_val("detected_at")
        data.append({
            "Vulnerability ID": get_val("cve_id"),
            "Software Name": get_val("software_name"),
            "Version": get_val("version"),
            "Environment": get_val("environment"),
            "CVSS Score": get_val("cvss_score"),
            "Status": get_val("status"),
            "Assigned Engineer": get_val("assigned_engineer") or "Unassigned",
            "Published Date": pub_date.strftime("%Y-%m-%d") if isinstance(pub_date, datetime) else str(pub_date or ""),
            "Detected At": det_date.strftime("%Y-%m-%d %H:%M") if isinstance(det_date, datetime) else str(det_date or "")
        })

    df = pd.DataFrame(data)

    # Write to a memory buffer
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Vulnerabilities")
    
    return output.getvalue()

import io
from datetime import datetime
import pandas as pd

def export_vulnerabilities_to_excel(vulnerabilities: list) -> bytes:
    """
    Exports a list of vulnerability objects/dicts to Excel binary bytes.
    """
    data = []
    for v in vulnerabilities:
        data.append({
            "Vulnerability ID": v.get("cve_id"),
            "Software Name": v.get("software_name"),
            "Version": v.get("version"),
            "Environment": v.get("environment"),
            "CVSS Score": v.get("cvss_score"),
            "Status": v.get("status"),
            "Assigned Engineer": v.get("assigned_engineer") or "Unassigned",
            "Published Date": v.get("published_date").strftime("%Y-%m-%d") if isinstance(v.get("published_date"), datetime) else str(v.get("published_date")),
            "Detected At": v.get("detected_at").strftime("%Y-%m-%d %H:%M") if isinstance(v.get("detected_at"), datetime) else str(v.get("detected_at"))
        })

    df = pd.DataFrame(data)

    # Write to a memory buffer
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Vulnerabilities")
    
    return output.getvalue()

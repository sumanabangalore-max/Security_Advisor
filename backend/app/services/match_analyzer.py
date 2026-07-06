from .match_scoring import calculate_match_score

def analyze_match_confidence(inv_name: str, inv_version: str, cve_name: str, cve_version: str) -> tuple[float, str]:
    """
    Returns:
      (confidence_score 0.0 to 1.0, confidence_level 'High'|'Medium'|'Low')
    """
    name_score = calculate_match_score(inv_name, cve_name)
    if name_score == 0.0:
        return 0.0, "Low"

    # Version comparison: simple exact, starts with, or inclusion
    v1 = str(inv_version).strip().lower()
    v2 = str(cve_version).strip().lower()

    if v1 == v2 or v2 == "all" or v2 == "*":
        version_score = 1.0
    elif v1 in v2 or v2 in v1:
        version_score = 0.9
    else:
        version_score = 0.5

    confidence = (name_score * 0.6) + (version_score * 0.4)
    
    if confidence >= 0.85:
        level = "High"
    elif confidence >= 0.6:
        level = "Medium"
    else:
        level = "Low"

    return round(confidence, 2), level

def rescore_match_with_llm(cve_id: str, software_name: str, current_score: float) -> float:
    # Rule-based manual rescore simulating a LLM explanation
    # Just adjustments or smart increments
    return min(1.0, current_score + 0.1)

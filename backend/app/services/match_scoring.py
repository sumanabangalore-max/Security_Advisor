ALIASES = {
    "apache http server": ["apache", "httpd", "apache http_server", "apache_http_server"],
    "httpd": ["apache", "apache http server", "apache_http_server"],
    "postgresql": ["postgres", "postgresql database"],
    "postgres": ["postgresql", "postgresql database"],
    "node.js": ["node", "nodejs", "node.js runtime"],
    "node": ["node.js", "nodejs"],
    "tomcat": ["apache tomcat", "tomcat server"]
}

def clean_name(name: str) -> str:
    return str(name).lower().strip()

def calculate_match_score(inv_name: str, cve_name: str) -> float:
    n1 = clean_name(inv_name)
    n2 = clean_name(cve_name)

    # Exact Match
    if n1 == n2:
        return 1.0

    # Alias Match
    if n1 in ALIASES and any(alias in n2 for alias in ALIASES[n1]):
        return 0.95
    if n2 in ALIASES and any(alias in n1 for alias in ALIASES[n2]):
        return 0.95

    # Substring Match
    if n1 in n2 or n2 in n1:
        return 0.85

    # Word Overlap Match
    w1 = set(n1.replace("-", " ").replace("_", " ").split())
    w2 = set(n2.replace("-", " ").replace("_", " ").split())
    intersection = w1.intersection(w2)
    
    if intersection:
        # Avoid matching generic terms like "server" or "system"
        meaningful = intersection - {"server", "system", "software", "service", "engine", "runtime"}
        if len(meaningful) > 0:
            return 0.5 + (len(meaningful) / max(len(w1), len(w2))) * 0.4

    return 0.0

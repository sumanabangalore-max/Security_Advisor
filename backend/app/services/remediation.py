def generate_remediation(cve_id: str, software_name: str, version: str) -> str:
    s_name = str(software_name).lower()
    
    verify_linux = ""
    mitigate_linux = ""
    verify_powershell = ""
    mitigate_powershell = ""

    if "apache" in s_name or "httpd" in s_name:
        verify_linux = "apache2 -v\n# Or on RHEL:\nhttpd -v"
        mitigate_linux = "sudo apt-get update && sudo apt-get install --only-upgrade apache2\n# Or on RHEL:\nsudo dnf upgrade httpd"
        verify_powershell = "Get-Service -Name '*Apache*' | Select-Object Name, Status\n# Or check path:\n& \"C:\\apache\\bin\\httpd.exe\" -v"
        mitigate_powershell = "Stop-Service -Name 'Apache*'\n# Download latest zip, extract to target folder and restart service:\nStart-Service -Name 'Apache*'"
    elif "openssl" in s_name:
        verify_linux = "openssl version"
        mitigate_linux = "sudo apt-get update && sudo apt-get install --only-upgrade openssl"
        verify_powershell = "[System.Diagnostics.FileVersionInfo]::GetVersionInfo((Get-Command openssl.exe).Source).FileVersion"
        mitigate_powershell = "# Download OpenSSL MSI package and install:\nStart-Process msiexec.exe -ArgumentList '/i openssl-latest.msi /quiet /qn' -Wait"
    elif "nginx" in s_name:
        verify_linux = "nginx -v"
        mitigate_linux = "sudo apt-get update && sudo apt-get install --only-upgrade nginx"
        verify_powershell = "& \"C:\\nginx\\nginx.exe\" -v"
        mitigate_powershell = "Stop-Process -Name 'nginx'\n# Copy new files into C:\\nginx\\\nStart-Process -FilePath \"C:\\nginx\\nginx.exe\""
    elif "postgresql" in s_name or "postgres" in s_name:
        verify_linux = "postgres --version\n# Or check active PG service:\npsql -U postgres -c \"SELECT version();\""
        mitigate_linux = "sudo apt-get update && sudo apt-get install --only-upgrade postgresql-12"
        verify_powershell = "& \"C:\\Program Files\\PostgreSQL\\12\\bin\\postgres.exe\" --version"
        mitigate_powershell = "Stop-Service -Name 'postgresql*'\n# Execute PostgreSQL installer with quiet flags:\nStart-Process -FilePath \"postgresql-12-latest-windows-x64.exe\" -ArgumentList '--mode unattended' -Wait\nStart-Service -Name 'postgresql*'"
    elif "node" in s_name:
        verify_linux = "node -v"
        mitigate_linux = "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\nsudo apt-get install -y nodejs"
        verify_powershell = "node -v"
        mitigate_powershell = "# Install using Chocolatey package manager:\nchoco upgrade nodejs -y"
    elif "tomcat" in s_name:
        verify_linux = "catalina.sh version"
        mitigate_linux = "# Download latest Tomcat package and update symlink:\nwget https://dlcdn.apache.org/tomcat/tomcat-9/v9.0.x/bin/apache-tomcat-9.0.x.tar.gz"
        verify_powershell = "& \"C:\\tomcat\\bin\\version.bat\""
        mitigate_powershell = "Stop-Service -Name 'Tomcat*'\n# Extract latest zip, overwrite bin and lib folders, then restart service:\nStart-Service -Name 'Tomcat*'"
    else:
        verify_linux = f"# Verify installation details for {software_name}\nwhich {s_name} || dpkg -l | grep {s_name}"
        mitigate_linux = f"# Upgrade {software_name} to patch {cve_id}\nsudo apt-get update && sudo apt-get install --only-upgrade {s_name}"
        verify_powershell = f"# Verify installation on Windows\nGet-Command {s_name}.exe | Select-Object Source, Version"
        mitigate_powershell = f"# Apply updates or patch for {software_name} to fix {cve_id}\n# Verify with vendor specific installer flags"

    remediation_text = f"""### Remediation Guide for {cve_id} in {software_name} (Current Version: {version})

#### Linux / Bash Environment

##### 1. Verification Command
```bash
{verify_linux}
```

##### 2. Mitigation Command
```bash
{mitigate_linux}
```

---

#### Windows / PowerShell Environment

##### 1. Verification Command
```powershell
{verify_powershell}
```

##### 2. Mitigation Command
```powershell
{mitigate_powershell}
```
"""
    return remediation_text

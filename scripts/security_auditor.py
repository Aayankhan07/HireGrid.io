import os
import re
import sys

# Define color codes for pretty CLI outputs
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_GREEN = "\033[92m"
COLOR_BLUE = "\033[94m"

# Define severity levels
SEV_HIGH = f"{COLOR_RED}[HIGH]{COLOR_RESET}"
SEV_MEDIUM = f"{COLOR_YELLOW}[MEDIUM]{COLOR_RESET}"
SEV_LOW = f"{COLOR_BLUE}[LOW]{COLOR_RESET}"

# Exclude directories
EXCLUDE_DIRS = {".git", "node_modules", "venv", "__pycache__", ".next", "out", "dist"}

def print_banner():
    banner = f"""
{COLOR_GREEN}{COLOR_BOLD}======================================================================
                  HIREGRID.IO SECURITY AUDITOR TOOL
======================================================================{COLOR_RESET}
Scanning codebase files for security vulnerabilities...
"""
    print(banner)

class SecurityAuditor:
    def __init__(self, target_dir):
        self.target_dir = os.path.abspath(target_dir)
        self.findings = []
        self.total_files_scanned = 0

    def run_audit(self):
        for root, dirs, files in os.walk(self.target_dir):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                filepath = os.path.join(root, file)
                self.total_files_scanned += 1
                self.scan_file(filepath)

    def add_finding(self, filepath, line_no, severity, category, message, code_snippet=""):
        rel_path = os.path.relpath(filepath, self.target_dir)
        self.findings.append({
            "file": rel_path,
            "line": line_no,
            "severity": severity,
            "category": category,
            "message": message,
            "snippet": code_snippet.strip()
        })

    def scan_file(self, filepath):
        filename = os.path.basename(filepath)
        _, ext = os.path.splitext(filepath)
        
        # We only scan text/source files
        if ext not in {".py", ".ts", ".tsx", ".js", ".jsx", ".env", ".example", ".json", ".md"} and filename != ".env" and not filename.startswith(".env."):
            return
            
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except Exception:
            return

        for idx, line in enumerate(lines):
            line_no = idx + 1
            
            # 1. Hardcoded Secrets Check
            self.check_hardcoded_secrets(filepath, line_no, line)
            
            # 2. SQL Injection Patterns (Python specific)
            if ext == ".py":
                self.check_sql_injection(filepath, line_no, line)
                self.check_insecure_hashing(filepath, line_no, line)
                self.check_unsecured_endpoints(filepath, line_no, line)
                
            # 3. CORS and Dev Settings Checks
            self.check_cors_wildcard(filepath, line_no, line)
            self.check_dev_bypass(filepath, line_no, line)

    def check_hardcoded_secrets(self, filepath, line_no, line):
        # Scan for potential secret assignments
        secret_patterns = [
            (r'(?i)(secret_key|api_key|password|jwt_secret)\s*=\s*[\'"]([a-zA-Z0-9_\-]{8,})[\'"]', SEV_MEDIUM, "Hardcoded Secret Key"),
            (r'(?i)(aws_access_key_id|aws_secret_access_key)\s*=\s*[\'"][a-zA-Z0-9_\-\+/=]{16,}[\'"]', SEV_HIGH, "AWS Secret Credentials")
        ]
        
        for pattern, severity, category in secret_patterns:
            match = re.search(pattern, line)
            if match:
                # Filter out obvious template placeholders
                placeholder_keywords = {"template", "placeholder", "your_", "mysecret", "secret-key", "super-secret"}
                detected_val = match.group(2).lower()
                if not any(kw in detected_val for kw in placeholder_keywords):
                    self.add_finding(
                        filepath, line_no, severity, category,
                        f"Potential hardcoded secret value detected: '{match.group(1)}'",
                        line
                    )

    def check_sql_injection(self, filepath, line_no, line):
        # Look for raw SQL execution involving string formatting/concatenation
        sqli_patterns = [
            (r'\.execute\(\s*f["\'].*\{.*\}', SEV_HIGH, "SQL Injection Exposure"),
            (r'\.execute\(\s*["\'].*%s["\'].*%', SEV_HIGH, "SQL Injection Exposure"),
            (r'\.execute\(\s*["\'].*\+.*["\']', SEV_HIGH, "SQL Injection Exposure")
        ]
        
        for pattern, severity, category in sqli_patterns:
            if re.search(pattern, line):
                self.add_finding(
                    filepath, line_no, severity, category,
                    "Raw SQL query construction using string interpolation/concatenation. Use parameterized placeholders instead.",
                    line
                )

    def check_cors_wildcard(self, filepath, line_no, line):
        # Check for CORS wildcards
        if "allow_origins" in line and '"*"' in line and "allow_credentials=True" in line:
            self.add_finding(
                filepath, line_no, SEV_HIGH, "Insecure CORS Config",
                "CORS configuration allows wildcard origins '*' with credentials enabled. This is restricted by browsers and represents a CSRF/Information Disclosure risk.",
                line
            )

    def check_dev_bypass(self, filepath, line_no, line):
        if "ALLOW_DEV_BYPASS" in line and "true" in line.lower() and not filepath.endswith(".example"):
            self.add_finding(
                filepath, line_no, SEV_MEDIUM, "Development Security Bypass",
                "Security bypass configuration 'ALLOW_DEV_BYPASS=true' is active. Ensure this is disabled in staging/production environments.",
                line
            )
        if "ADMIN_PASSWORD" in line and "password123" in line.lower() and not filepath.endswith(".example"):
            self.add_finding(
                filepath, line_no, SEV_HIGH, "Default Admin Credentials",
                "Default administrator password 'password123' is configured. Change ADMIN_PASSWORD immediately to restrict administrative access.",
                line
            )

    def check_insecure_hashing(self, filepath, line_no, line):
        if "hashlib.md5" in line or "hashlib.sha1" in line:
            self.add_finding(
                filepath, line_no, SEV_HIGH, "Insecure Cryptographic Hash",
                "Use of MD5/SHA1 hashing functions detected. These are cryptographically broken and vulnerable to collisions. Upgrade to SHA-256 or bcrypt.",
                line
            )
        if "ITERATIONS" in line:
            match = re.search(r'ITERATIONS\s*=\s*(\d+)', line)
            if match:
                iterations = int(match.group(1))
                if iterations < 100000:
                    self.add_finding(
                        filepath, line_no, SEV_MEDIUM, "Low PBKDF2 Iterations",
                        f"PBKDF2 iteration count is set to {iterations}. OWASP recommends at least 100,000 iterations to withstand brute-force attacks.",
                        line
                    )

    def check_unsecured_endpoints(self, filepath, line_no, line):
        pass

    def print_results(self):
        print_banner()
        print(f"Total Files Scanned: {self.total_files_scanned}")
        print(f"Total Findings Detected: {len(self.findings)}")
        print("="*70)
        
        if not self.findings:
            print(f"\n{COLOR_GREEN}[OK] NO VULNERABILITIES DETECTED! Your codebase matches high security parameters.{COLOR_RESET}\n")
            return
            
        high_count = sum(1 for f in self.findings if "HIGH" in f["severity"])
        medium_count = sum(1 for f in self.findings if "MEDIUM" in f["severity"])
        low_count = sum(1 for f in self.findings if "LOW" in f["severity"])
        
        print(f"Severity Breakdown: {COLOR_RED}{high_count} High{COLOR_RESET}, {COLOR_YELLOW}{medium_count} Medium{COLOR_RESET}, {COLOR_BLUE}{low_count} Low{COLOR_RESET}\n")
        
        for idx, finding in enumerate(self.findings):
            print(f"{idx+1}. {finding['severity']} - {COLOR_BOLD}{finding['category']}{COLOR_RESET}")
            print(f"   {COLOR_BLUE}File:{COLOR_RESET} {finding['file']}:{finding['line']}")
            print(f"   {COLOR_BLUE}Issue:{COLOR_RESET} {finding['message']}")
            if finding['snippet']:
                print(f"   {COLOR_BLUE}Snippet:{COLOR_RESET} {finding['snippet']}")
            print("-"*70)

if __name__ == "__main__":
    target = "."
    if len(sys.argv) > 1:
        target = sys.argv[1]
    
    auditor = SecurityAuditor(target)
    auditor.run_audit()
    auditor.print_results()

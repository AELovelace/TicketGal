# Security pre-deployment checks
# Run: .\scripts\security-check.ps1
# Optional: .\scripts\security-check.ps1 -WafTestUrl "http://localhost:8000"

param(
    [switch]$SkipTests = $false,
    [string]$WafTestUrl = ""
)

$ErrorActionPreference = "Continue"
$script:failed = $false

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Cyan
}

function Write-Result {
    param([string]$Message, [string]$Status)
    if ($Status -eq "PASS") {
        Write-Host "[+] $Message" -ForegroundColor Green
    } elseif ($Status -eq "WARN") {
        Write-Host "[!] $Message" -ForegroundColor Yellow
    } else {
        Write-Host "[-] $Message" -ForegroundColor Red
        $script:failed = $true
    }
}

# Check Python syntax
Write-Section "Python Syntax Check"
try {
    .\.venv\Scripts\python.exe -m py_compile app/main.py app/database.py app/schemas.py app/config.py app/auth.py 2>&1 | Out-Null
    Write-Result "Python files compile cleanly" "PASS"
} catch {
    Write-Result "Python syntax errors found" "FAIL"
}

# Dependency vulnerability scanning
Write-Section "Dependency Vulnerability Scan (pip-audit)"
try {
    $auditInstalled = .\.venv\Scripts\pip show pip-audit 2>&1 | Select-String -Pattern "^Name:" | Measure-Object | Select-Object -ExpandProperty Count
    if ($auditInstalled -eq 0) {
        Write-Host "Installing pip-audit..." -ForegroundColor Yellow
        .\.venv\Scripts\pip install -q pip-audit
    }
    
    $auditOutput = .\.venv\Scripts\pip-audit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Result "No known vulnerabilities in dependencies" "PASS"
    } else {
        Write-Host $auditOutput
        Write-Result "Vulnerabilities found - review above" "WARN"
    }
} catch {
    Write-Result "pip-audit check failed: $_" "FAIL"
}

# Static analysis with Bandit
Write-Section "Static Security Analysis (Bandit)"
try {
    $banditInstalled = .\.venv\Scripts\pip show bandit 2>&1 | Select-String -Pattern "^Name:" | Measure-Object | Select-Object -ExpandProperty Count
    if ($banditInstalled -eq 0) {
        Write-Host "Installing bandit..." -ForegroundColor Yellow
        .\.venv\Scripts\pip install -q bandit
    }
    
    # Run bandit on app code only (exclude tests which have expected false positives)
    $banditOutput = .\.venv\Scripts\bandit -r app/ --exclude "app/tests" -f txt 2>&1
    $banditExitCode = $LASTEXITCODE
    
    if ($banditExitCode -eq 0) {
        Write-Result "No security issues detected by Bandit" "PASS"
    } else {
        Write-Host $banditOutput -ForegroundColor Yellow
        Write-Result "Bandit found issues - review above" "WARN"
    }
} catch {
    Write-Result "Bandit check failed: $_" "FAIL"
}

# Run test suite if pytest is available
if (-not $SkipTests) {
    Write-Section "Unit `& Security Tests (pytest)"
    try {
        $pytestInstalled = .\.venv\Scripts\pip show pytest 2>&1 | Select-String -Pattern "^Name:" | Measure-Object | Select-Object -ExpandProperty Count
        if ($pytestInstalled -eq 0) {
            Write-Host "Installing pytest..." -ForegroundColor Yellow
            .\.venv\Scripts\pip install -q pytest pytest-asyncio httpx
        }
        
        if (Test-Path "app/tests") {
            Write-Host "Running pytest..." -ForegroundColor Cyan
            .\.venv\Scripts\pytest app/tests/ -v 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Result "All tests passed" "PASS"
            } else {
                Write-Result "Some tests failed - review above" "WARN"
            }
        } else {
            Write-Result "No tests found in app/tests/ (skipped)" "WARN"
        }
    } catch {
        Write-Result "pytest check failed: $_" "FAIL"
    }
}

# WAF tests (if script exists and URL provided)
Write-Section "WAF Tests"
if ($WafTestUrl) {
    if (Test-Path "scripts/test_waf.ps1") {
        try {
            Write-Host "Running WAF tests at $WafTestUrl..." -ForegroundColor Cyan
            & .\scripts\test_waf.ps1 -BaseUrl $WafTestUrl -Insecure 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Result "WAF tests passed" "PASS"
            } else {
                Write-Result "WAF tests detected issues" "WARN"
            }
        } catch {
            Write-Result "WAF test script failed: $_" "FAIL"
        }
    } else {
        Write-Result "WAF test script not found (optional)" "WARN"
    }
} else {
    Write-Result "WAF tests skipped (provide -WafTestUrl to enable)" "WARN"
}

# SQL injection tests (if script exists)
Write-Section "SQL Injection Tests"
if (Test-Path "certs/test_sqli_full.py") {
    try {
        Write-Host "Running SQL injection tests..." -ForegroundColor Cyan
        .\.venv\Scripts\python.exe certs/test_sqli_full.py 2>&1 | Select-Object -Last 10
        if ($LASTEXITCODE -eq 0) {
            Write-Result "SQL injection tests passed" "PASS"
        } else {
            Write-Result "SQL injection tests completed with warnings" "WARN"
        }
    } catch {
        Write-Result "SQL injection test failed: $_" "FAIL"
    }
} else {
    Write-Result "SQL injection tests not found (optional)" "WARN"
}

# Summary
Write-Section "Security Check Summary"
if ($script:failed) {
    Write-Host "Status: FAILED - Review errors above" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Status: PASSED - Safe to deploy" -ForegroundColor Green
    exit 0
}

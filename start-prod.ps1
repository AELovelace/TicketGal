$ErrorActionPreference = "Stop"

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
        $parts = $_ -split "=", 2
        if ($parts.Length -eq 2) {
            [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim())
        }
    }
}

$hostAddr = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$port = if ($env:PORT) { $env:PORT } else { "8000" }
$workers = if ($env:WEB_CONCURRENCY) { $env:WEB_CONCURRENCY } else { "2" }

$pythonCmd = if (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" } else { "python" }

$isWindowsHost = $env:OS -like "*Windows*"
if ($isWindowsHost -and [int]$workers -gt 1) {
    Write-Host "Windows host detected: forcing WEB_CONCURRENCY=1 for uvicorn stability."
    $workers = "1"
}

$existingListener = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
    $pid = $existingListener.OwningProcess
    $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
    throw "Port $port is already in use by PID $pid ($processName). Stop that process or change PORT in .env."
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

& $pythonCmd -m uvicorn app.main:app --host $hostAddr --port $port --workers $workers --proxy-headers 2>&1 | ForEach-Object { Write-Host $_ }
$exitCode = $LASTEXITCODE

$ErrorActionPreference = $previousErrorActionPreference

if ($exitCode -ne 0 -and $exitCode -ne 130) {
    throw "Uvicorn exited with code $exitCode"
}

param(
    [switch]$AutoKillPort
)

$ErrorActionPreference = "Stop"

if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
        $parts = $_ -split "=", 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()

            # Avoid setting global TLS env vars that would override CA trust for all outbound HTTPS.
            if ($key -eq "SSL_CERT_FILE") {
                if (-not $env:TICKETGAL_SSL_CERT_FILE) {
                    [System.Environment]::SetEnvironmentVariable("TICKETGAL_SSL_CERT_FILE", $value)
                }
                return
            }
            if ($key -eq "SSL_KEY_FILE") {
                if (-not $env:TICKETGAL_SSL_KEY_FILE) {
                    [System.Environment]::SetEnvironmentVariable("TICKETGAL_SSL_KEY_FILE", $value)
                }
                return
            }

            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

# Ensure legacy TLS variables do not break outbound HTTPS trust validation.
if ($env:SSL_CERT_FILE) {
    Remove-Item Env:SSL_CERT_FILE -ErrorAction SilentlyContinue
}
if ($env:SSL_KEY_FILE) {
    Remove-Item Env:SSL_KEY_FILE -ErrorAction SilentlyContinue
}

$hostAddr = if ($env:HOST) { $env:HOST } else { "0.0.0.0" }
$port = if ($env:PORT) { $env:PORT } else { "8000" }
$workers = if ($env:WEB_CONCURRENCY) { $env:WEB_CONCURRENCY } else { "2" }
$httpsFlag = ("{0}" -f $env:HTTPS_ENABLED).Trim().ToLowerInvariant()
$httpsEnabled = ($httpsFlag -eq "1" -or $httpsFlag -eq "true" -or $httpsFlag -eq "yes")
$autoKillPortFlag = ("{0}" -f $env:AUTO_KILL_PORT).Trim().ToLowerInvariant()
$autoKillPortEnabled = $AutoKillPort -or $autoKillPortFlag -in @("1", "true", "yes")
$autoGenerateCert = ($env:AUTO_GENERATE_DEV_CERT -ne "0")
$sslCertFile = if ($env:TICKETGAL_SSL_CERT_FILE) { $env:TICKETGAL_SSL_CERT_FILE } else { "certs/dev-cert.pem" }
$sslKeyFile = if ($env:TICKETGAL_SSL_KEY_FILE) { $env:TICKETGAL_SSL_KEY_FILE } else { "certs/dev-key.pem" }

$pythonCmd = if (Test-Path ".venv\Scripts\python.exe") { ".venv\Scripts\python.exe" } else { "python" }

$isWindowsHost = $env:OS -like "*Windows*"
if ($isWindowsHost -and [int]$workers -gt 1) {
    Write-Host "Windows host detected: forcing WEB_CONCURRENCY=1 for uvicorn stability."
    $workers = "1"
}

$existingListener = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
    $listenerPid = $existingListener.OwningProcess
    $processName = (Get-Process -Id $listenerPid -ErrorAction SilentlyContinue).ProcessName
    if ($autoKillPortEnabled) {
        Write-Host "Port $port is in use by PID $listenerPid ($processName). Stopping process..."
        Stop-Process -Id $listenerPid -Force
        Start-Sleep -Milliseconds 300

        $listenerCheck = Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listenerCheck) {
            throw "Failed to free port $port after killing PID $listenerPid."
        }
        Write-Host "Port $port has been freed."
    }
    else {
        throw "Port $port is already in use by PID $listenerPid ($processName). Stop that process, run .\start-prod.ps1 -AutoKillPort, or set AUTO_KILL_PORT=1 in .env."
    }
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

$uvicornArgs = @(
    "-m", "uvicorn",
    "app.main:app",
    "--host", $hostAddr,
    "--port", $port,
    "--workers", $workers,
    "--proxy-headers"
)

if ($httpsEnabled) {
    if ((-not (Test-Path $sslCertFile)) -or (-not (Test-Path $sslKeyFile))) {
        if (-not $autoGenerateCert) {
            throw "HTTPS is enabled but SSL cert or key file is missing. Set SSL_CERT_FILE/SSL_KEY_FILE or enable AUTO_GENERATE_DEV_CERT=1."
        }

        Write-Host "Generating self-signed development certificate..."
        & $pythonCmd "scripts/generate_self_signed_cert.py" --cert-file $sslCertFile --key-file $sslKeyFile --hosts "$hostAddr,localhost,127.0.0.1"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate self-signed certificate."
        }
    }

    Write-Host "HTTPS enabled with cert $sslCertFile"
    $uvicornArgs += @("--ssl-certfile", $sslCertFile, "--ssl-keyfile", $sslKeyFile)
}

& $pythonCmd @uvicornArgs 2>&1 | ForEach-Object { Write-Host $_ }
$exitCode = $LASTEXITCODE

$ErrorActionPreference = $previousErrorActionPreference

if ($exitCode -ne 0 -and $exitCode -ne 130) {
    throw "Uvicorn exited with code $exitCode"
}

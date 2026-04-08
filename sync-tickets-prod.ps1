# This script syncs all tickets from Atera into the production ticket cache database
# It should be run after deploying the updated app/main.py and restarting the prod server

param(
    [Parameter(Mandatory=$true)]
    [string]$ProductionUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$AdminEmail,
    
    [Parameter(Mandatory=$true)]
    [string]$AdminPassword
)

# Disable SSL verification for self-signed certs (if applicable)
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

$ErrorActionPreference = "Stop"

Write-Host "TicketGal Production Ticket Cache Sync" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "Step 1: Authenticating as admin..." -ForegroundColor Yellow
try {
    $loginUrl = "$ProductionUrl/auth/login"
    $loginResponse = Invoke-WebRequest `
        -Uri $loginUrl `
        -Method POST `
        -ContentType "application/json" `
        -Body (ConvertTo-Json @{
            email = $AdminEmail
            password = $AdminPassword
        }) `
        -UseBasicParsing `
        -SessionVariable session
    
    Write-Host "✓ Authentication successful" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "✗ Authentication failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Call sync endpoint
Write-Host "Step 2: Syncing all tickets from Atera..." -ForegroundColor Yellow
Write-Host "(This may take a few minutes if you have many tickets)" -ForegroundColor Gray
try {
    $syncUrl = "$ProductionUrl/api/admin/sync-tickets-from-atera"
    $syncResponse = Invoke-WebRequest `
        -Uri $syncUrl `
        -Method POST `
        -WebSession $session `
        -ContentType "application/json" `
        -UseBasicParsing
    
    $syncBody = ConvertFrom-Json $syncResponse.Content
    Write-Host "✓ Sync successful" -ForegroundColor Green
    Write-Host ""
    Write-Host $syncBody.message -ForegroundColor Green
    Write-Host "Total tickets synced: $($syncBody.ticket_count)" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "✗ Sync failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup complete! Production reports should now show historical data." -ForegroundColor Green
Write-Host "If reports still show no data, try refreshing the browser or restarting the app." -ForegroundColor Gray

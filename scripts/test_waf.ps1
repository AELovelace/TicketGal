param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [ValidateSet("detection", "blocking")]
    [string]$Mode = "blocking",

    [switch]$Insecure
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl.Contains("://")) {
    $BaseUrl = "https://$BaseUrl"
}
$BaseUrl = $BaseUrl.TrimEnd('/')

try {
    $tls12 = [System.Net.SecurityProtocolType]::Tls12
    if ([Enum]::GetNames([System.Net.SecurityProtocolType]) -contains "Tls13") {
        [System.Net.ServicePointManager]::SecurityProtocol = $tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    }
    else {
        [System.Net.ServicePointManager]::SecurityProtocol = $tls12
    }
}
catch {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
}

if ($Insecure) {
    # PowerShell 7+ supports -SkipCertificateCheck per request; for Windows PowerShell 5.1,
    # this callback helps with self-signed cert test environments.
    try {
        Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public static class TrustAllCertsPolicy {
    public static bool Validator(object sender, X509Certificate certificate, X509Chain chain, System.Net.Security.SslPolicyErrors errors) {
        return true;
    }
}
"@ -ErrorAction SilentlyContinue | Out-Null
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { param($sender, $cert, $chain, $errors) return $true }
    }
    catch {
        # Ignore certificate callback setup issues; request layer may still support skip flags.
    }
}

$passCount = 0
$failCount = 0

function Write-Result {
    param(
        [bool]$Passed,
        [string]$Name,
        [string]$Detail
    )

    if ($Passed) {
        Write-Host ("PASS {0,-36} {1}" -f $Name, $Detail)
        $script:passCount += 1
    }
    else {
        Write-Host ("FAIL {0,-36} {1}" -f $Name, $Detail)
        $script:failCount += 1
    }
}

function Invoke-WafRequest {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Path,
        [string]$Body,
        [string]$ContentType
    )

    $uri = "{0}{1}" -f $BaseUrl, $Path

    $params = @{
        Uri           = $uri
        Method        = $Method
        TimeoutSec    = 20
        MaximumRedirection = 0
        ErrorAction   = "Stop"
    }

    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
        $params.UseBasicParsing = $true
    }

    if ($Body) {
        $params.Body = $Body
    }
    if ($ContentType) {
        $params.ContentType = $ContentType
    }

    if ($Insecure -and (Get-Command Invoke-WebRequest).Parameters.ContainsKey("SkipCertificateCheck")) {
        $params.SkipCertificateCheck = $true
    }

    try {
        $response = Invoke-WebRequest @params
        return [int]$response.StatusCode
    }
    catch {
        $exception = $_.Exception
        if ($exception.Response -and $exception.Response.StatusCode) {
            return [int]$exception.Response.StatusCode.value__
        }
        return -1
    }
}

Write-Host ("Testing WAF at {0} (mode={1})" -f $BaseUrl, $Mode)

$healthCode = Invoke-WafRequest -Method "GET" -Path "/health"
Write-Result -Passed ($healthCode -eq 200) -Name "health endpoint" -Detail ("HTTP {0}" -f $healthCode)

$benignBody = '{"description":"Printer queue is stuck on floor 2.","ticket_title":"Printer queue issue"}'
$benignCode = Invoke-WafRequest -Method "POST" -Path "/api/tickets/ai-assist" -Body $benignBody -ContentType "application/json"
$benignOk = @(200, 401, 403) -contains $benignCode
Write-Result -Passed $benignOk -Name "benign protected POST" -Detail ("HTTP {0}" -f $benignCode)

$xssBody = '{"description":"<script>alert(1)</script>","ticket_title":"xss probe"}'
$xssCode = Invoke-WafRequest -Method "GET" -Path "/?waf_xss=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
if ($Mode -eq "blocking") {
    Write-Result -Passed ($xssCode -eq 403) -Name "xss probe" -Detail ("HTTP {0}" -f $xssCode)
}
else {
    Write-Result -Passed ($xssCode -ne 500 -and $xssCode -ne -1) -Name "xss probe" -Detail ("HTTP {0}" -f $xssCode)
}

$sqliCode = Invoke-WafRequest -Method "GET" -Path "/?waf_probe=%27%20or%201%3D1--"
if ($Mode -eq "blocking") {
    Write-Result -Passed ($sqliCode -eq 403) -Name "sqli query probe" -Detail ("HTTP {0}" -f $sqliCode)
}
else {
    Write-Result -Passed ($sqliCode -ne 500 -and $sqliCode -ne -1) -Name "sqli query probe" -Detail ("HTTP {0}" -f $sqliCode)
}

$oauthCode = Invoke-WafRequest -Method "GET" -Path "/auth/microsoft/callback?code=test-code&state=test-state"
Write-Result -Passed ($oauthCode -ne 500 -and $oauthCode -ne -1) -Name "oauth callback sanity" -Detail ("HTTP {0}" -f $oauthCode)

Write-Host ""
Write-Host ("Summary: {0} passed, {1} failed" -f $passCount, $failCount)

if ($failCount -gt 0) {
    Write-Host "Check /var/log/nginx/error.log and /var/log/nginx/modsec_audit.log for failed cases."
    exit 1
}

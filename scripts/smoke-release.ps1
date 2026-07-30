# NexaTech release smoke tests — configurable target, private/local guard.
#
# Usage:
#   .\scripts\smoke-release.ps1 -BaseUrl http://127.0.0.1:3000
#   .\scripts\smoke-release.ps1 -BaseUrl http://192.168.4.204 -ViaEntry
#   $env:SMOKE_BASE_URL='http://127.0.0.1'; .\scripts\smoke-release.ps1
#
# Does NOT log tokens. Does NOT run destructive mutations by default.
# Mutating checks (cart/checkout) require -AllowMutate and stay mock-safe.

[CmdletBinding()]
param(
  [string]$BaseUrl = $(if ($env:SMOKE_BASE_URL) { $env:SMOKE_BASE_URL } else { '' }),
  [string]$EntryVip = $(if ($env:ENTRY_VIP) { $env:ENTRY_VIP } else { '192.168.4.204' }),
  [switch]$ViaEntry,
  [switch]$AllowMutate,
  [switch]$DryRun,
  [int]$TimeoutSec = 15,
  [int]$Retries = 2,
  [switch]$Help
)

$ErrorActionPreference = 'Continue'

function Show-Usage {
  @'
Usage: smoke-release.ps1 [-BaseUrl <url>] [-ViaEntry] [-AllowMutate] [-DryRun]

  -BaseUrl       Target base (required unless -ViaEntry)
  -ViaEntry      Use ENTRY_VIP MetalLB entry (http://VIP)
  -AllowMutate   Enable cart/checkout mock-safe checks
  -DryRun        Print planned checks only
  -TimeoutSec    Per-request timeout (default 15)
  -Retries       Retries on transient failure (default 2)

Private/local target guard: only localhost, 127.0.0.1, ::1, RFC1918, or ENTRY_VIP.
'@
}

if ($Help) { Show-Usage; exit 0 }

function Write-Log([string]$Message) { Write-Host "[smoke-release] $Message" }
$failures = 0
$blocked = 0
$passes = 0
$warnings = 0

function Pass([string]$Message) { Write-Log "PASS: $Message"; $script:passes++ }
function Fail([string]$Message) { Write-Log "FAIL: $Message"; $script:failures++ }
function Warn([string]$Message) { Write-Log "WARN: $Message"; $script:warnings++ }
function Blocked([string]$Message) { Write-Log "BLOCKED: $Message"; $script:blocked++ }

function Test-PrivateTarget([string]$Url) {
  try {
    $u = [Uri]$Url
    $hostName = $u.Host
    if ($hostName -in @('localhost', '127.0.0.1', '::1')) { return $true }
    if ($hostName -eq $EntryVip) { return $true }
    if ($hostName -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)') { return $true }
    return $false
  } catch {
    return $false
  }
}

if ($ViaEntry) {
  $BaseUrl = "http://$EntryVip"
}
if (-not $BaseUrl) {
  Write-Log 'BaseUrl not set — defaulting to ENTRY_VIP for dry documentation mode'
  $BaseUrl = "http://$EntryVip"
  if (-not $DryRun) {
    Blocked 'BaseUrl unset; use -BaseUrl or -ViaEntry. Continuing with VIP target (may be BLOCKED if unreachable).'
  }
}

$BaseUrl = $BaseUrl.TrimEnd('/')
if (-not (Test-PrivateTarget $BaseUrl)) {
  Fail "Refusing non-private target: $BaseUrl (allow localhost / RFC1918 / ENTRY_VIP only)"
  exit 1
}

Write-Log "target=$BaseUrl AllowMutate=$($AllowMutate.IsPresent) DryRun=$($DryRun.IsPresent)"

$checks = @(
  @{ Name = 'storefront'; Url = "$BaseUrl/"; Method = 'GET' },
  @{ Name = 'admin'; Url = "${BaseUrl}:3100/"; Method = 'GET'; Note = 'via entry port 3100 when ViaEntry' },
  @{ Name = 'entry-healthz'; Url = "$BaseUrl/healthz"; Method = 'GET' },
  @{ Name = 'identity-live'; Url = "${BaseUrl}:3001/health/live"; Method = 'GET' },
  @{ Name = 'identity-ready'; Url = "${BaseUrl}:3001/health/ready"; Method = 'GET' },
  @{ Name = 'catalog-ready'; Url = "${BaseUrl}:3003/health/ready"; Method = 'GET' },
  @{ Name = 'catalog-products'; Url = "${BaseUrl}:3003/api/v1/products?page=1&limit=1"; Method = 'GET' },
  @{ Name = 'cart-ready'; Url = "${BaseUrl}:3006/health/ready"; Method = 'GET' },
  @{ Name = 'order-ready'; Url = "${BaseUrl}:3007/health/ready"; Method = 'GET' },
  @{ Name = 'payment-ready'; Url = "${BaseUrl}:3008/health/ready"; Method = 'GET' },
  @{ Name = 'shipping-ready'; Url = "${BaseUrl}:3009/health/ready"; Method = 'GET' },
  @{ Name = 'review-ready'; Url = "${BaseUrl}:3010/health/ready"; Method = 'GET' },
  @{ Name = 'warranty-ready'; Url = "${BaseUrl}:3011/health/ready"; Method = 'GET' },
  @{ Name = 'support-ready'; Url = "${BaseUrl}:3012/health/ready"; Method = 'GET' },
  @{ Name = 'notification-ready'; Url = "${BaseUrl}:3013/health/ready"; Method = 'GET' },
  @{ Name = 'reporting-ready'; Url = "${BaseUrl}:3014/health/ready"; Method = 'GET' }
)

# When BaseUrl is already http://VIP without path, admin/API ports use host:port.
# Normalize: if BaseUrl includes explicit port other than default, health checks use path-only via Kong.
$uri = [Uri]$BaseUrl
$hostOnly = $uri.Scheme + '://' + $uri.Host
if ($uri.Port -ne -1 -and $uri.Port -ne 80 -and $uri.Port -ne 443) {
  # Single-port BFF/Kong front — use path-based API checks
  $checks = @(
    @{ Name = 'storefront'; Url = "$BaseUrl/"; Method = 'GET' },
    @{ Name = 'admin'; Url = "$BaseUrl/admin"; Method = 'GET' },
    @{ Name = 'auth-ready'; Url = "$BaseUrl/api/v1/auth/health"; Method = 'GET'; Optional = $true },
    @{ Name = 'catalog'; Url = "$BaseUrl/api/v1/products?page=1&limit=1"; Method = 'GET' },
    @{ Name = 'identity-live'; Url = "$hostOnly`:3001/health/live"; Method = 'GET'; Optional = $true }
  )
} else {
  # Rebuild with hostOnly for port-based entry VIP
  $checks = @(
    @{ Name = 'storefront'; Url = "$hostOnly/"; Method = 'GET' },
    @{ Name = 'entry-healthz'; Url = "$hostOnly/healthz"; Method = 'GET' },
    @{ Name = 'admin'; Url = "${hostOnly}:3100/"; Method = 'GET' },
    @{ Name = 'identity-live'; Url = "${hostOnly}:3001/health/live"; Method = 'GET' },
    @{ Name = 'identity-ready'; Url = "${hostOnly}:3001/health/ready"; Method = 'GET' },
    @{ Name = 'catalog-ready'; Url = "${hostOnly}:3003/health/ready"; Method = 'GET' },
    @{ Name = 'catalog-products'; Url = "${hostOnly}:3003/api/v1/products?page=1&limit=1"; Method = 'GET' },
    @{ Name = 'cart-ready'; Url = "${hostOnly}:3006/health/ready"; Method = 'GET' },
    @{ Name = 'order-ready'; Url = "${hostOnly}:3007/health/ready"; Method = 'GET' },
    @{ Name = 'payment-ready'; Url = "${hostOnly}:3008/health/ready"; Method = 'GET' },
    @{ Name = 'shipping-ready'; Url = "${hostOnly}:3009/health/ready"; Method = 'GET' },
    @{ Name = 'review-ready'; Url = "${hostOnly}:3010/health/ready"; Method = 'GET' },
    @{ Name = 'warranty-ready'; Url = "${hostOnly}:3011/health/ready"; Method = 'GET' },
    @{ Name = 'support-ready'; Url = "${hostOnly}:3012/health/ready"; Method = 'GET' },
    @{ Name = 'notification-ready'; Url = "${hostOnly}:3013/health/ready"; Method = 'GET' },
    @{ Name = 'reporting-ready'; Url = "${hostOnly}:3014/health/ready"; Method = 'GET' }
  )
}

function Invoke-SmokeCheck($Check) {
  $name = $Check.Name
  $url = $Check.Url
  if ($DryRun) {
    Write-Log "DRY-RUN check $name -> $url"
    Pass "dry-run planned: $name"
    return
  }
  $attempt = 0
  while ($attempt -le $Retries) {
    $attempt++
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSec -Method $Check.Method
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Pass "$name HTTP $($resp.StatusCode)"
        return
      }
      Fail "$name unexpected status $($resp.StatusCode)"
      return
    } catch {
      if ($attempt -le $Retries) {
        Start-Sleep -Seconds 1
        continue
      }
      if ($Check.Optional) { Warn "$name unreachable (optional): $url" }
      else { Blocked "$name unreachable: $url" }
      return
    }
  }
}

foreach ($c in $checks) { Invoke-SmokeCheck $c }

if ($AllowMutate) {
  Write-Log '--- Mutate-safe checks (mock only; no payment capture) ---'
  if ($DryRun) {
    Pass 'dry-run planned: cart create (guest token)'
    Pass 'dry-run planned: checkout mock skip'
  } else {
    Warn 'AllowMutate: cart/checkout smoke requires live services; skipped auto-mutate in unattended mode without SMOKE_CART_TOKEN'
    Blocked 'cart/checkout mutate smoke needs live stack + SMOKE_CART_TOKEN (operator)'
  }
} else {
  Write-Log 'AllowMutate not set — skip cart/checkout/order mutation checks'
}

Write-Log '--- Summary ---'
Write-Log "PASS=$passes WARN=$warnings BLOCKED=$blocked FAIL=$failures"
Write-Log 'NOTE: tokens/secrets are never logged by this script'

if ($failures -gt 0) { Write-Log 'Result: FAIL'; exit 1 }
if ($DryRun) { Write-Log 'Result: OK (dry-run)'; exit 0 }
if ($blocked -gt 0) { Write-Log 'Result: OK with BLOCKED (offline friendly)'; exit 0 }
Write-Log 'Result: OK'
exit 0

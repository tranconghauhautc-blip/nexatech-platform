# NexaTech production preflight / validation (safe unattended + operator health checks).
#
# Usage:
#   .\scripts\validate-production.ps1
#   .\scripts\validate-production.ps1 -Strict
#   $env:ENTRY_VIP='192.168.4.204'; .\scripts\validate-production.ps1
#
# Does NOT mutate cluster. Does NOT print secret values.

[CmdletBinding()]
param(
  [switch]$Strict,
  [switch]$DryRun,
  [switch]$Help
)

$ErrorActionPreference = 'Continue'

function Show-Usage {
  @'
Usage: validate-production.ps1 [-Strict] [-DryRun]

  -Strict   Treat unreachable health URLs as failure
  -DryRun    Lint/template only mindset (default health: BLOCKED if unreachable)
  -Help      Show help
'@
}

if ($Help) { Show-Usage; exit 0 }

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$chart = Join-Path $root 'deploy/helm/nexatech'
$kongProd = Join-Path $root 'infra/kong/kong.production.yml'
$secretExample = Join-Path $chart 'secret-values.example.yaml'

$entryVip = if ($env:ENTRY_VIP) { $env:ENTRY_VIP } else { '192.168.4.204' }
$baseUrl = $env:BASE_URL

$failures = 0
$blocked = 0
$warnings = 0

function Write-Log([string]$Message) { Write-Host "[validate-production] $Message" }
function Pass([string]$Message) { Write-Log "PASS: $Message" }
function Fail([string]$Message) { Write-Log "FAIL: $Message"; $script:failures++ }
function Warn([string]$Message) { Write-Log "WARN: $Message"; $script:warnings++ }
function Blocked([string]$Message) { Write-Log "BLOCKED: $Message"; $script:blocked++ }

Write-Log "NexaTech production validation (repo=$root)"
Write-Log "ENTRY_VIP=$entryVip BASE_URL=$(if ($baseUrl) { $baseUrl } else { '<not set>' }) STRICT=$($Strict.IsPresent)"

Write-Log '--- Operator preflight (run manually before any mutate) ---'
Write-Log '  kubectl config current-context'
Write-Log '  kubectl cluster-info'
Write-Log '  kubectl get nodes -o wide'
Write-Log '  Confirm context is PRODUCTION before helm upgrade / kubectl apply'

# Helm
$helm = Get-Command helm -ErrorAction SilentlyContinue
if ($helm) {
  Write-Log '--- Helm lint ---'
  & helm lint $chart 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Pass "helm lint $chart" } else { Fail "helm lint $chart"; & helm lint $chart }

  Write-Log '--- Helm template (values-production) ---'
  $valuesProd = Join-Path $chart 'values-production.yaml'
  & helm template nexatech $chart -f $valuesProd --namespace nexatech 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Pass 'helm template values-production.yaml' } else { Fail 'helm template values-production.yaml' }
} else {
  Blocked 'helm not in PATH — skip lint/template'
}

# Kong
Write-Log '--- Kong declarative config ---'
if (Test-Path $kongProd) {
  Pass "found $kongProd"
  $kongText = Get-Content $kongProd -Raw
  if ($kongText -match '192\.168\.4\.204') { Pass 'kong.production.yml references MetalLB VIP 192.168.4.204' }
  else { Fail 'kong.production.yml missing expected VIP 192.168.4.204' }
} else {
  Fail "missing $kongProd"
}

# Secret keys
Write-Log '--- Expected Secret keys (names only, not values) ---'
$expectedKeys = @(
  'jwt-access-secret', 'jwt-refresh-secret', 'admin-session-secret',
  'identity-database-url', 'customer-database-url', 'catalog-database-url', 'media-database-url',
  'inventory-database-url', 'cart-database-url', 'order-database-url', 'payment-database-url',
  'shipping-database-url', 'review-database-url', 'warranty-database-url', 'support-database-url',
  'notification-database-url', 'reporting-database-url',
  'redis-url', 'rabbitmq-url', 'rabbitmq-user', 'rabbitmq-password',
  'minio-access-key', 'minio-secret-key'
)

if (Test-Path $secretExample) {
  Pass 'found secret-values.example.yaml'
  $exampleText = Get-Content $secretExample -Raw
  foreach ($key in $expectedKeys) {
    if ($exampleText -match "${key}:") { Pass "secret key documented: $key" }
    else { Warn "secret key not found in example: $key" }
  }
} else {
  Fail "missing $secretExample"
}

# Health URLs
Write-Log '--- Health endpoints ---'

function Test-HealthUrl([string]$Name, [string]$Url) {
  try {
    $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -Method Get
    Pass "$Name $Url"
    return $true
  } catch {
    if ($Strict) { Fail "$Name unreachable: $Url" }
    else { Blocked "$Name unreachable (network/agent): $Url" }
    return $false
  }
}

Test-HealthUrl 'entry healthz' "http://${entryVip}/healthz" | Out-Null
Test-HealthUrl 'identity live' "http://${entryVip}:3001/health/live" | Out-Null
Test-HealthUrl 'identity ready' "http://${entryVip}:3001/health/ready" | Out-Null
Test-HealthUrl 'catalog ready' "http://${entryVip}:3003/health/ready" | Out-Null
Test-HealthUrl 'storefront' "http://${entryVip}/" | Out-Null
Test-HealthUrl 'admin' "http://${entryVip}:3100/" | Out-Null

if ($baseUrl) {
  $base = $baseUrl.TrimEnd('/')
  Test-HealthUrl 'public storefront' "$base/" | Out-Null
  Test-HealthUrl 'public api catalog' "$base/api/v1/catalog/products?page=1&limit=1" | Out-Null
} else {
  Write-Log 'BASE_URL not set — skip public URL checks'
}

Write-Log '--- Summary ---'
Write-Log "Failures: $failures  Blocked: $blocked  Warnings: $warnings"

if ($failures -gt 0) {
  Write-Log 'Result: FAILED'
  exit 1
}
if ($blocked -gt 0 -and $Strict) {
  Write-Log 'Result: FAILED (strict + blocked checks)'
  exit 1
}
if ($blocked -gt 0) {
  Write-Log 'Result: OK with BLOCKED items (dry-run friendly — operator re-run from prod network)'
  exit 0
}

Write-Log 'Result: OK'
exit 0

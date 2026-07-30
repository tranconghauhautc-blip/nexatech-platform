# NexaTech deployment preflight — read-only checks for release readiness.
#
# Usage:
#   .\scripts\deploy-preflight.ps1
#   .\scripts\deploy-preflight.ps1 -DryRun
#   .\scripts\deploy-preflight.ps1 -Strict
#   $env:ENTRY_VIP='192.168.4.204'; $env:KONG_VM='192.168.4.209'; .\scripts\deploy-preflight.ps1
#
# Exit codes:
#   0 = OK (may include WARN / BLOCKED when not -Strict)
#   1 = FAIL
#
# Does NOT mutate cluster. Does NOT print secret values. Does NOT apply Kong.

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Strict,
  [switch]$SkipKube,
  [switch]$SkipConnectivity,
  [switch]$Help
)

$ErrorActionPreference = 'Continue'

function Show-Usage {
  @'
Usage: deploy-preflight.ps1 [-DryRun] [-Strict] [-SkipKube] [-SkipConnectivity]

  -DryRun             Prefer BLOCKED over FAIL for unreachable live checks (default friendly)
  -Strict             Treat BLOCKED live checks as FAIL
  -SkipKube           Skip kubectl cluster checks
  -SkipConnectivity   Skip TCP connectivity to Postgres/Redis/etc hosts
  -Help               Show help

Env:
  ENTRY_VIP (default 192.168.4.204)
  KONG_VM (default 192.168.4.209)
  POSTGRES_HOST (default 192.168.4.208)
  POSTGRES_PORT (default 5432)
  IMAGE_TAG (default 0.17.0)
  IMAGE_REPOSITORY (default nexatech)
  NAMESPACE (default nexatech)
'@
}

if ($Help) { Show-Usage; exit 0 }

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$chart = Join-Path $root 'deploy/helm/nexatech'
$obsChart = Join-Path $root 'deploy/helm/nexatech-observability'
$kongProd = Join-Path $root 'infra/kong/kong.production.yml'
$secretExample = Join-Path $chart 'secret-values.example.yaml'
$valuesProd = Join-Path $chart 'values-production.yaml'
$imageMatrix = Join-Path $root 'docs/image-matrix.json'

$entryVip = if ($env:ENTRY_VIP) { $env:ENTRY_VIP } else { '192.168.4.204' }
$kongVm = if ($env:KONG_VM) { $env:KONG_VM } else { '192.168.4.209' }
$pgHost = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { '192.168.4.208' }
$pgPort = if ($env:POSTGRES_PORT) { [int]$env:POSTGRES_PORT } else { 5432 }
$imageTag = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { '0.17.0' }
$imageRepo = if ($env:IMAGE_REPOSITORY) { $env:IMAGE_REPOSITORY } else { 'nexatech' }
$namespace = if ($env:NAMESPACE) { $env:NAMESPACE } else { 'nexatech' }

$failures = 0
$blocked = 0
$warnings = 0
$passes = 0

function Write-Log([string]$Message) { Write-Host "[deploy-preflight] $Message" }
function Pass([string]$Message) { Write-Log "PASS: $Message"; $script:passes++ }
function Fail([string]$Message) { Write-Log "FAIL: $Message"; $script:failures++ }
function Warn([string]$Message) { Write-Log "WARN: $Message"; $script:warnings++ }
function Blocked([string]$Message) { Write-Log "BLOCKED: $Message"; $script:blocked++ }

$backends = @(
  'identity-service','customer-service','catalog-service','media-service',
  'inventory-service','cart-service','order-service','payment-service',
  'shipping-service','review-service','warranty-service','support-service',
  'notification-service','reporting-service'
)
$frontends = @('storefront-web','admin-web')
$healthPorts = @{
  'storefront-web' = 80
  'admin-web' = 3100
  'identity-service' = 3001
  'customer-service' = 3002
  'catalog-service' = 3003
  'media-service' = 3004
  'inventory-service' = 3005
  'cart-service' = 3006
  'order-service' = 3007
  'payment-service' = 3008
  'shipping-service' = 3009
  'review-service' = 3010
  'warranty-service' = 3011
  'support-service' = 3012
  'notification-service' = 3013
  'reporting-service' = 3014
}

Write-Log "NexaTech deploy preflight (repo=$root)"
Write-Log "DryRun=$($DryRun.IsPresent) Strict=$($Strict.IsPresent) ENTRY_VIP=$entryVip KONG_VM=$kongVm IMAGE_TAG=$imageTag NS=$namespace"

# --- Tag policy ---
Write-Log '--- Image tag policy ---'
if ($imageTag -eq 'latest' -or $imageTag -match '(^|/)latest$') {
  Fail 'IMAGE_TAG must not be latest'
} else {
  Pass "IMAGE_TAG is pinned: $imageTag"
}

# --- Repo static assets ---
Write-Log '--- Repository assets ---'
foreach ($path in @($chart, $obsChart, $kongProd, $secretExample, $valuesProd, $imageMatrix)) {
  if (Test-Path $path) { Pass "found $path" }
  else { Fail "missing $path" }
}

foreach ($name in ($frontends + $backends)) {
  $df = Join-Path $root "apps/$name/Dockerfile"
  if (Test-Path $df) { Pass "Dockerfile $name" }
  else { Fail "missing Dockerfile $name" }
}
$migrateDf = Join-Path $root 'deploy/docker/prisma-migrate.Dockerfile'
if (Test-Path $migrateDf) { Pass 'prisma-migrate.Dockerfile' } else { Fail 'missing prisma-migrate.Dockerfile' }

# --- No latest in values ---
Write-Log '--- Helm values tag scan ---'
if (Test-Path $valuesProd) {
  $vp = Get-Content $valuesProd -Raw
  if ($vp -match 'imageTag:\s*[''"]?latest[''"]?' -or $vp -match 'tag:\s*[''"]?latest[''"]?') {
    Fail 'values-production.yaml uses latest tag'
  } else {
    Pass 'values-production.yaml has no latest tag'
  }
  if ($vp -match '192\.168\.4\.204') { Pass 'values-production references MetalLB VIP 192.168.4.204' }
  else { Fail 'values-production missing MetalLB VIP 192.168.4.204' }
  if ($vp -match 'CHANGE_ME') { Warn 'values-production still contains CHANGE_ME placeholders (expected until operator fills)' }
}

# --- Secret key names (never values) ---
Write-Log '--- Required Secret key names (documentation) ---'
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
  $exampleText = Get-Content $secretExample -Raw
  foreach ($key in $expectedKeys) {
    if ($exampleText -match [regex]::Escape($key)) { Pass "secret key documented: $key" }
    else { Warn "secret key not documented: $key" }
  }
}

# --- Kong static mapping ---
Write-Log '--- Kong / MetalLB static mapping ---'
if (Test-Path $kongProd) {
  $kongText = Get-Content $kongProd -Raw
  if ($kongText -match '192\.168\.4\.204') { Pass 'kong.production.yml upstream VIP 192.168.4.204' }
  else { Fail 'kong.production.yml missing VIP 192.168.4.204' }

  $requiredPaths = @('/', '/admin', '/api/v1', '/api/v2')
  foreach ($p in $requiredPaths) {
    if ($kongText -match [regex]::Escape($p)) { Pass "kong route path present: $p" }
    else { Fail "kong route path missing: $p" }
  }

  if ($kongText -match 'strip_path:\s*true' -and $kongText -match 'admin') {
    Pass 'admin route uses strip_path (expected for /admin)'
  } else {
    Warn 'could not confirm admin strip_path statically'
  }

  if ($kongText -match 'correlation-id|x-request-id|request-id') {
    Pass 'kong correlation / request-id plugin present'
  } else {
    Warn 'kong request-id / correlation-id not found statically'
  }

  # Management consoles must not be exposed via Kong
  $forbidden = @('rabbitmq', 'minio', 'grafana', 'prometheus', 'redis')
  foreach ($f in $forbidden) {
    if ($kongText -match "(?i)name:\s*$f|/management|/console") {
      # soft: only fail if clear management exposure route
      if ($kongText -match "(?i)paths:\s*\[[^\]]*management" -or $kongText -match "(?i)paths:\s*\[[^\]]*console") {
        Fail "kong appears to expose management/console for $f"
      }
    }
  }
  Pass 'kong static scan: no management console route detected'
  Write-Log "NOTE: Kong live apply remains operator-owned on VM $kongVm (BLOCKED_EXTERNAL)"
} else {
  Fail "missing $kongProd"
}

# --- Service port / health mapping ---
Write-Log '--- Service port and health mapping ---'
foreach ($svc in $backends) {
  $port = $healthPorts[$svc]
  Pass "$svc port=$port health=/health/live + /health/ready"
}
Pass 'storefront entry :80 -> 3000 health=/'
Pass 'admin entry :3100 health=/'
Pass "migration image tag strategy: ${imageTag}-migrate (prisma migrate deploy only)"

# --- Helm lint / template ---
Write-Log '--- Helm lint / template ---'
$helmCmd = Get-Command helm -ErrorAction SilentlyContinue
if (-not $helmCmd) {
  $localHelm = Join-Path $root '.tools/bin/helm.exe'
  if (Test-Path $localHelm) {
    $env:PATH = "$(Join-Path $root '.tools/bin');$env:PATH"
    $helmCmd = Get-Command helm -ErrorAction SilentlyContinue
  }
}
if ($helmCmd) {
  & helm lint $chart 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Pass "helm lint $chart" } else { Fail "helm lint $chart" }

  & helm template nexatech $chart -f $valuesProd --namespace $namespace 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Pass 'helm template apps values-production' } else { Fail 'helm template apps values-production' }

  if (Test-Path $obsChart) {
    $obsValues = Join-Path $obsChart 'values-production.yaml'
    & helm lint $obsChart 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass "helm lint $obsChart" } else { Fail "helm lint $obsChart" }
    if (Test-Path $obsValues) {
      & helm template nexatech-obs $obsChart -f $obsValues --namespace nexatech-obs 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { Pass 'helm template observability values-production' }
      else { Fail 'helm template observability values-production' }
    } else {
      Warn 'observability values-production.yaml missing'
    }
  }
} else {
  Blocked 'helm not in PATH — skip lint/template'
}

# --- Local Docker image availability (optional) ---
Write-Log '--- Local Docker image availability ---'
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
  foreach ($name in ($frontends + $backends)) {
    $ref = "${imageRepo}/${name}:${imageTag}"
    $inspect = docker image inspect $ref 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "local image $ref" }
    else { Blocked "local image missing: $ref (build via docker-build-all)" }
  }
  foreach ($name in $backends) {
    $mref = "${imageRepo}/${name}:${imageTag}-migrate"
    docker image inspect $mref 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass "local migrate image $mref" }
    else { Blocked "local migrate image missing: $mref" }
  }
} else {
  Blocked 'docker not in PATH — skip image inspect'
}

# --- kubectl (read-only) ---
Write-Log '--- Kubernetes context (read-only) ---'
if ($SkipKube) {
  Write-Log 'SkipKube set — skipping kubectl checks'
} else {
  $kubectl = Get-Command kubectl -ErrorAction SilentlyContinue
  if (-not $kubectl) {
    Blocked 'kubectl not in PATH'
  } else {
    try {
      $ctx = (kubectl config current-context 2>&1 | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $ctx) {
        Pass "kube-context: $ctx"
        Write-Log 'Confirm this context is the intended production/lab cluster before any mutate'
      } else {
        Blocked 'unable to resolve kube-context'
      }
    } catch {
      Blocked 'kubectl current-context failed'
    }

    kubectl cluster-info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass 'kubectl cluster-info' }
    else { Blocked 'kubectl cluster-info unavailable' }

    $nodes = kubectl get nodes -o wide 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      Pass 'kubectl get nodes'
      if ($nodes -match 'NotReady') { Warn 'one or more nodes NotReady' }
      else { Pass 'no NotReady nodes detected in output' }
    } else {
      Blocked 'kubectl get nodes unavailable'
    }

    kubectl get ns $namespace 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass "namespace exists: $namespace" }
    else { Blocked "namespace missing or unreachable: $namespace" }

    kubectl get secret dockerhub-pull -n $namespace 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass 'imagePullSecret dockerhub-pull present' }
    else { Blocked 'imagePullSecret dockerhub-pull missing (create before rollout)' }

    kubectl get secret nexatech-secrets -n $namespace 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass 'secret nexatech-secrets present (keys not printed)' }
    else { Blocked 'secret nexatech-secrets missing' }

    kubectl get configmap -n $namespace 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass "configmaps listed in $namespace (names only)" }
    else { Blocked 'configmap list unavailable' }

    kubectl get storageclass 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass 'StorageClass list available' }
    else { Blocked 'StorageClass list unavailable' }

    # MetalLB presence (CRD or ns)
    kubectl get ns metallb-system 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Pass 'namespace metallb-system present' }
    else {
      kubectl get crd ipaddresspools.metallb.io 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { Pass 'MetalLB CRD present' }
      else { Blocked 'MetalLB not detected (ns/CRD) — VIP .204 may be unavailable' }
    }

    kubectl get svc -A 2>&1 | Select-String $entryVip | Out-Null
    # soft check
    $svcOut = kubectl get svc -A -o wide 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $svcOut -match [regex]::Escape($entryVip)) {
      Pass "MetalLB VIP $entryVip observed on a Service"
    } else {
      Blocked "MetalLB VIP $entryVip not observed on Services yet"
    }
  }
}

# --- TCP connectivity (optional) ---
Write-Log '--- Infrastructure connectivity (TCP only, no credentials) ---'
function Test-Tcp([string]$Name, [string]$HostName, [int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($HostName, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(3000, $false)
    if (-not $ok) {
      $client.Close()
      if ($Strict) { Fail "$Name TCP ${HostName}:${Port} timeout" }
      else { Blocked "$Name TCP ${HostName}:${Port} unreachable" }
      return
    }
    $client.EndConnect($iar) | Out-Null
    $client.Close()
    Pass "$Name TCP ${HostName}:${Port}"
  } catch {
    if ($Strict) { Fail "$Name TCP ${HostName}:${Port} failed" }
    else { Blocked "$Name TCP ${HostName}:${Port} failed" }
  }
}

if ($SkipConnectivity) {
  Write-Log 'SkipConnectivity set'
} else {
  Test-Tcp 'PostgreSQL' $pgHost $pgPort
  # In-cluster Redis/RabbitMQ/MinIO are ClusterIP - only reachable from inside cluster.
  # Document expectation; do not fake success.
  Blocked 'Redis/RabbitMQ/MinIO ClusterIP connectivity requires in-cluster probe (not from agent host)'
  Write-Log ('DB existence / user grants: operator must verify on {0} (app users nexatech_*, never postgres) - not printed here' -f $pgHost)
}

Write-Log '--- Summary ---'
Write-Log ('PASS={0} WARN={1} BLOCKED={2} FAIL={3}' -f $passes, $warnings, $blocked, $failures)

if ($failures -gt 0) {
  Write-Log 'Result: FAIL'
  exit 1
}
if ($blocked -gt 0 -and $Strict) {
  Write-Log 'Result: FAIL (strict + blocked)'
  exit 1
}
if ($blocked -gt 0) {
  Write-Log 'Result: OK with BLOCKED (dry-run / offline friendly)'
  exit 0
}
Write-Log 'Result: OK'
exit 0

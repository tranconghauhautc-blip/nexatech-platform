<#
.SYNOPSIS
  Build a portable NexaTech lab deploy kit (Helm chart + values + install scripts).

.DESCRIPTION
  Output: dist/nexatech-lab-kit-<chartVersion>.zip

  Images stay on GHCR (ghcr.io/<owner>/nexatech/<svc>:<tag>).
  The zip only carries Helm + install helpers — cluster pulls images at install time.

.EXAMPLE
  pwsh -File scripts/package-lab-kit.ps1
#>
[CmdletBinding()]
param(
  [string]$Owner = 'tranconghauhautc-blip',
  [string]$ImageTag = '0.17.0',
  [string]$MigrationImageTag = '0.17.1-migrate',
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$chartYaml = Get-Content -Raw (Join-Path $root 'deploy/helm/nexatech/Chart.yaml')
if ($chartYaml -notmatch "(?m)^version:\s*'?([^'\s]+)'?") {
  throw 'Cannot read chart version from deploy/helm/nexatech/Chart.yaml'
}
$chartVersion = $Matches[1]

if (-not $OutDir) {
  $OutDir = Join-Path $root "dist/nexatech-lab-kit-$chartVersion"
}
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$chartsDir = Join-Path $OutDir 'charts'
New-Item -ItemType Directory -Force -Path $chartsDir | Out-Null

$helm = if (Get-Command helm -ErrorAction SilentlyContinue) {
  (Get-Command helm).Source
} elseif (Test-Path (Join-Path $root '.tools/helm.exe')) {
  Join-Path $root '.tools/helm.exe'
} else {
  throw 'helm not found — install Helm or place helm.exe in .tools/'
}
Write-Host "==> helm package deploy/helm/nexatech -> $chartsDir" -ForegroundColor Cyan
& $helm package (Join-Path $root 'deploy/helm/nexatech') -d $chartsDir
if ($LASTEXITCODE -ne 0) { throw 'helm package failed' }

$chartTgz = Get-ChildItem $chartsDir -Filter 'nexatech-*.tgz' | Select-Object -First 1
if (-not $chartTgz) { throw 'helm package produced no .tgz' }

Copy-Item (Join-Path $root 'deploy/environments/staging/values-ghcr.yaml') (Join-Path $OutDir 'values-ghcr.yaml')
Copy-Item (Join-Path $root 'deploy/helm/nexatech/secret-values.example.yaml') (Join-Path $OutDir 'secret-values.example.yaml')

# secret.env.example — kubectl --from-env-file friendly
$secretEnv = @"
# Copy to secret.env and fill real values. DO NOT commit secret.env.
# kubectl -n nexatech create secret generic nexatech-secrets --from-env-file=./secret.env

jwt-access-secret=REPLACE_MIN_32_CHARS_ACCESS_SECRET_HERE
jwt-refresh-secret=REPLACE_MIN_32_CHARS_REFRESH_SECRET_HERE
admin-session-secret=REPLACE_MIN_16_CHARS

identity-database-url=postgresql://nexatech_identity:PASSWORD@192.168.3.50:5432/nexatech_identity?sslmode=prefer
customer-database-url=postgresql://nexatech_customer:PASSWORD@192.168.3.50:5432/nexatech_customer?sslmode=prefer
catalog-database-url=postgresql://nexatech_catalog:PASSWORD@192.168.3.50:5432/nexatech_catalog?sslmode=prefer
media-database-url=postgresql://nexatech_media:PASSWORD@192.168.3.50:5432/nexatech_media?sslmode=prefer
inventory-database-url=postgresql://nexatech_inventory:PASSWORD@192.168.3.50:5432/nexatech_inventory?sslmode=prefer
cart-database-url=postgresql://nexatech_cart:PASSWORD@192.168.3.50:5432/nexatech_cart?sslmode=prefer
order-database-url=postgresql://nexatech_order:PASSWORD@192.168.3.50:5432/nexatech_order?sslmode=prefer
payment-database-url=postgresql://nexatech_payment:PASSWORD@192.168.3.50:5432/nexatech_payment?sslmode=prefer
shipping-database-url=postgresql://nexatech_shipping:PASSWORD@192.168.3.50:5432/nexatech_shipping?sslmode=prefer
review-database-url=postgresql://nexatech_review:PASSWORD@192.168.3.50:5432/nexatech_review?sslmode=prefer
warranty-database-url=postgresql://nexatech_warranty:PASSWORD@192.168.3.50:5432/nexatech_warranty?sslmode=prefer
support-database-url=postgresql://nexatech_support:PASSWORD@192.168.3.50:5432/nexatech_support?sslmode=prefer
notification-database-url=postgresql://nexatech_notification:PASSWORD@192.168.3.50:5432/nexatech_notification?sslmode=prefer
reporting-database-url=postgresql://nexatech_reporting:PASSWORD@192.168.3.50:5432/nexatech_reporting?sslmode=prefer

redis-url=redis://nexatech-redis:6379
rabbitmq-url=amqp://nexatech:PASSWORD@nexatech-rabbitmq:5672
rabbitmq-user=nexatech
rabbitmq-password=REPLACE
minio-access-key=REPLACE
minio-secret-key=REPLACE

google-oauth-client-id=
google-oauth-client-secret=
smtp-host=
smtp-port=587
smtp-user=
smtp-password=
smtp-from=noreply@example.com
vnpay-tmn-code=
vnpay-hash-secret=
vnpay-url=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
vnpay-return-url=
ghn-token=
ghn-shop-id=
ghn-base-url=
app-base-url=http://192.168.4.204
admin-base-url=http://192.168.4.204:3100
"@
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $OutDir 'secret.env.example'), $secretEnv, $utf8NoBom)

$images = @(
  'identity-service','customer-service','catalog-service','media-service',
  'inventory-service','cart-service','order-service','payment-service',
  'shipping-service','review-service','warranty-service','support-service',
  'notification-service','reporting-service',
  'storefront-web','admin-web','swagger-portal','security-guide-portal'
)
$manifest = [ordered]@{
  chartVersion = $chartVersion
  imageRegistry = 'ghcr.io'
  imageRepository = "$Owner/nexatech"
  imageTag = $ImageTag
  migrationImageTag = $MigrationImageTag
  apps = @($images | ForEach-Object { "ghcr.io/$Owner/nexatech/${_}:$ImageTag" })
  migrations = @($images | Where-Object { $_ -like '*-service' } | ForEach-Object {
    "ghcr.io/$Owner/nexatech/${_}:$MigrationImageTag"
  })
}
[System.IO.File]::WriteAllText(
  (Join-Path $OutDir 'images-manifest.json'),
  ($manifest | ConvertTo-Json -Depth 5),
  $utf8NoBom
)

$installPs1 = @'
# NexaTech lab one-shot installer (PowerShell)
# Prerequisites: kubectl + helm, kubeconfig, StorageClass local-path, MetalLB VIP, external Postgres.
# Usage:
#   copy secret.env.example secret.env   # fill passwords
#   .\install.ps1
# Optional private GHCR:
#   $env:GHCR_USERNAME='tranconghauhautc-blip'
#   $env:GHCR_TOKEN='ghp_...'   # read:packages
#   .\install.ps1

[CmdletBinding()]
param(
  [string]$Namespace = 'nexatech',
  [string]$Release = 'nexatech',
  [string]$SecretEnv = '.\secret.env',
  [switch]$SkipWait
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$chart = Get-ChildItem (Join-Path $here 'charts') -Filter 'nexatech-*.tgz' | Select-Object -First 1
if (-not $chart) { throw 'Missing charts/nexatech-*.tgz' }
$values = Join-Path $here 'values-ghcr.yaml'
if (-not (Test-Path $values)) { throw 'Missing values-ghcr.yaml' }
if (-not (Test-Path $SecretEnv)) {
  throw "Missing $SecretEnv — copy secret.env.example to secret.env and fill values"
}

Write-Host "==> namespace $Namespace" -ForegroundColor Cyan
kubectl get ns $Namespace 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  kubectl create namespace $Namespace
  if ($LASTEXITCODE -ne 0) { throw 'kubectl create namespace failed' }
}

if ($env:GHCR_TOKEN) {
  $user = if ($env:GHCR_USERNAME) { $env:GHCR_USERNAME } else { 'tranconghauhautc-blip' }
  Write-Host "==> imagePullSecret ghcr-pull (private packages)" -ForegroundColor Yellow
  kubectl -n $Namespace delete secret ghcr-pull --ignore-not-found
  kubectl -n $Namespace create secret docker-registry ghcr-pull `
    --docker-server=ghcr.io `
    --docker-username=$user `
    --docker-password=$env:GHCR_TOKEN
  if ($LASTEXITCODE -ne 0) { throw 'create ghcr-pull failed' }
  $pullSecretOverlay = Join-Path $here 'values-pullsecret.generated.yaml'
  @"
global:
  imagePullSecrets:
    - name: ghcr-pull
"@ | Set-Content -Encoding utf8 -Path $pullSecretOverlay
} else {
  $pullSecretOverlay = $null
  Write-Host "==> no GHCR_TOKEN — assuming public GHCR packages" -ForegroundColor Green
}

Write-Host "==> secret nexatech-secrets from $SecretEnv" -ForegroundColor Cyan
kubectl -n $Namespace delete secret nexatech-secrets --ignore-not-found
kubectl -n $Namespace create secret generic nexatech-secrets --from-env-file=$SecretEnv
if ($LASTEXITCODE -ne 0) { throw 'create nexatech-secrets failed' }

$helmArgs = @(
  'upgrade','--install',$Release,$chart.FullName,
  '-n',$Namespace,
  '-f',$values
)
if ($pullSecretOverlay) { $helmArgs += @('-f', $pullSecretOverlay) }
if (-not $SkipWait) { $helmArgs += @('--wait','--timeout','20m') }

Write-Host "==> helm $($helmArgs -join ' ')" -ForegroundColor Cyan
& helm @helmArgs
if ($LASTEXITCODE -ne 0) { throw 'helm upgrade --install failed' }

Write-Host "OK: release $Release in ns $Namespace" -ForegroundColor Green
Write-Host "Check: kubectl -n $Namespace get pods"
Write-Host "Entry VIP (values): http://192.168.4.204"
'@
[System.IO.File]::WriteAllText((Join-Path $OutDir 'install.ps1'), $installPs1, $utf8NoBom)

$installSh = @'
#!/usr/bin/env bash
# NexaTech lab one-shot installer (bash)
# copy secret.env.example -> secret.env, then: ./install.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NS="${NAMESPACE:-nexatech}"
RELEASE="${RELEASE:-nexatech}"
SECRET_ENV="${SECRET_ENV:-$HERE/secret.env}"
CHART="$(ls "$HERE"/charts/nexatech-*.tgz | head -n1)"
VALUES="$HERE/values-ghcr.yaml"

test -f "$SECRET_ENV" || { echo "Missing $SECRET_ENV"; exit 1; }
test -f "$CHART" || { echo "Missing chart tgz"; exit 1; }

kubectl get ns "$NS" >/dev/null 2>&1 || kubectl create namespace "$NS"

EXTRA_VALUES=()
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  USERNAME="${GHCR_USERNAME:-tranconghauhautc-blip}"
  echo "==> imagePullSecret ghcr-pull"
  kubectl -n "$NS" delete secret ghcr-pull --ignore-not-found
  kubectl -n "$NS" create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io \
    --docker-username="$USERNAME" \
    --docker-password="$GHCR_TOKEN"
  cat > "$HERE/values-pullsecret.generated.yaml" <<EOF
global:
  imagePullSecrets:
    - name: ghcr-pull
EOF
  EXTRA_VALUES+=(-f "$HERE/values-pullsecret.generated.yaml")
else
  echo "==> no GHCR_TOKEN — assuming public GHCR"
fi

echo "==> secret nexatech-secrets"
kubectl -n "$NS" delete secret nexatech-secrets --ignore-not-found
kubectl -n "$NS" create secret generic nexatech-secrets --from-env-file="$SECRET_ENV"

echo "==> helm upgrade --install"
helm upgrade --install "$RELEASE" "$CHART" \
  -n "$NS" \
  -f "$VALUES" \
  "${EXTRA_VALUES[@]}" \
  --wait --timeout 20m

echo "OK: $RELEASE in $NS"
kubectl -n "$NS" get pods
'@
# LF endings for bash
$installSh = $installSh -replace "`r`n", "`n"
[System.IO.File]::WriteAllText((Join-Path $OutDir 'install.sh'), $installSh)

Copy-Item (Join-Path $root 'deploy/lab-kit/README.md') (Join-Path $OutDir 'README.md')

$makePublic = @"
# Make GHCR packages public (one-time, GitHub UI only)

GitHub has no API to change container package visibility.
Open each link -> Package settings -> Danger Zone -> Change visibility -> Public.
Type the package name to confirm. Cannot revert to private.

Status 2026-08-12: all 18 NexaTech packages are already PUBLIC.

"@
foreach ($name in $images) {
  $enc = [uri]::EscapeDataString("nexatech/$name")
  $makePublic += "- [nexatech/$name](https://github.com/users/$Owner/packages/container/package/$enc)`n"
  $makePublic += "  settings: https://github.com/users/$Owner/packages/container/$([uri]::EscapeDataString("nexatech/$name"))/settings`n"
}
[System.IO.File]::WriteAllText((Join-Path $OutDir 'MAKE-PUBLIC.md'), $makePublic, $utf8NoBom)

$zipPath = Join-Path $root "dist/nexatech-lab-kit-$chartVersion.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $OutDir '*') -DestinationPath $zipPath -Force

Write-Host "OK: kit folder = $OutDir" -ForegroundColor Green
Write-Host "OK: zip        = $zipPath" -ForegroundColor Green
Write-Host "Copy the zip to the lab machine, unzip, fill secret.env, run install.ps1"

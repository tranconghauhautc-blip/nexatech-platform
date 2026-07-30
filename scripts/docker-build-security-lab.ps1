# Build security-lab tagged images (representative set).
# Requires Docker. Does NOT docker login / push.
param(
  [string]$Tag = '0.21.0-sec-lab',
  [string]$Repository = $(if ($env:IMAGE_REPOSITORY) { $env:IMAGE_REPOSITORY } else { 'nexatech' })
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

$names = @('identity-service', 'order-service', 'payment-service', 'storefront-web')
foreach ($name in $names) {
  $ref = "$Repository/${name}:$Tag"
  Write-Host "==> $ref"
  docker build -f "apps/$name/Dockerfile" `
    --build-arg NEXATECH_SECURITY_LAB=1 `
    --build-arg NEXATECH_DEPLOY_PROFILE=security-lab `
    -t $ref .
}
Write-Host 'Done. Helm lab values use imageTag 0.21.0-sec-lab. Push is OPERATOR-owned.'

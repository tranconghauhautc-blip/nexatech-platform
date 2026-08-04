<#
.SYNOPSIS
  Build all NexaTech images with immutable tag = HEAD short + dirty content hash.
#>
[CmdletBinding()]
param(
  [switch]$SkipMigrate,
  [switch]$FailFast = $true
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root
. (Join-Path $root 'scripts/deployment/_common.ps1')
Import-NexaTechDeployEnv -Root $root

$sha = (git rev-parse --short HEAD).Trim()
$hasher = [System.Security.Cryptography.SHA256]::Create()
$dirtyBytes = [System.Text.Encoding]::UTF8.GetBytes($(git status --porcelain | Out-String))
$dirtyHash = if ($dirtyBytes.Length -eq 0) { 'clean' } else {
  (($hasher.ComputeHash($dirtyBytes) | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 12)
}
$tag = if ($env:NEXATECH_IMAGE_TAG) { $env:NEXATECH_IMAGE_TAG } else { "$sha-$dirtyHash" }
$env:NEXATECH_IMAGE_TAG = $tag
$env:IMAGE_TAG = $tag

$registry = $env:CONTAINER_REGISTRY_URL
$ns = if ($env:CONTAINER_REGISTRY_NAMESPACE) { $env:CONTAINER_REGISTRY_NAMESPACE } else { 'nexatech' }

Write-Host "Immutable image tag: $tag"

$images = @(
  'identity-service','customer-service','catalog-service','media-service',
  'inventory-service','cart-service','order-service','payment-service',
  'shipping-service','review-service','warranty-service','support-service',
  'notification-service','reporting-service',
  'storefront-web','admin-web','swagger-portal','security-guide-portal'
)

$meta = @()
foreach ($name in $images) {
  $dockerfile = "apps/$name/Dockerfile"
  if (-not (Test-Path $dockerfile)) { throw "Missing $dockerfile" }
  $localRef = "nexatech/${name}:$tag"
  Write-Host "==> Building $localRef"
  docker build -f $dockerfile -t $localRef .
  if ($LASTEXITCODE -ne 0) {
    if ($FailFast) { throw "Build failed: $name" }
    continue
  }
  if ($registry) {
    $remote = "$registry/$ns/${name}:$tag"
    docker tag $localRef $remote
  }
  if (-not $SkipMigrate -and $name -like '*-service') {
    $mref = "nexatech/${name}:$tag-migrate"
    docker build -f deploy/docker/prisma-migrate.Dockerfile --build-arg SERVICE_NAME=$name -t $mref .
  }
  $meta += @{ name = $name; tag = $tag; local = $localRef }
}

$metaPath = Join-Path $root "deploy/checkpoints/images-$tag.json"
($meta | ConvertTo-Json -Depth 5) | Set-Content -Encoding utf8 -Path $metaPath
Save-Checkpoint -Name 'images-build' -Data @{ tag = $tag; meta = $metaPath }
Write-Host "Build metadata: $metaPath"

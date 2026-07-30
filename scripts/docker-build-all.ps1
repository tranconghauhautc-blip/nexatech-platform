# NexaTech Docker image catalog — build/push all or one.
# Usage (PowerShell):
#   .\scripts\docker-build-all.ps1
#   .\scripts\docker-build-all.ps1 -Image identity-service
#   .\scripts\docker-build-all.ps1 -Push  # requires prior: docker login
# Env:
#   DOCKERHUB_USER (optional registry user / org)
#   IMAGE_TAG (default: 0.17.0 or git SHA if -UseGitSha)
#   IMAGE_REPOSITORY (default: nexatech)
# Does NOT run docker login.

[CmdletBinding()]
param(
  [string]$Image = "",
  [string]$Tag = $env:IMAGE_TAG,
  [string]$Repository = $(if ($env:IMAGE_REPOSITORY) { $env:IMAGE_REPOSITORY } else { "nexatech" }),
  [string]$DockerHubUser = $env:DOCKERHUB_USER,
  [switch]$Push,
  [switch]$UseGitSha,
  [switch]$SkipMigrate,
  [switch]$FailFast = $true
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if ($UseGitSha) {
  $sha = (git rev-parse --short HEAD).Trim()
  if (-not $sha) { throw "Unable to resolve git SHA" }
  $Tag = $sha
}
if (-not $Tag) { $Tag = "0.17.0" }

$backends = @(
  "identity-service","customer-service","catalog-service","media-service",
  "inventory-service","cart-service","order-service","payment-service",
  "shipping-service","review-service","warranty-service","support-service",
  "notification-service","reporting-service"
)
$frontends = @("storefront-web","admin-web")
$all = $backends + $frontends

if ($Image) {
  if ($all -notcontains $Image) { throw "Unknown image: $Image. Valid: $($all -join ', ')" }
  $targets = @($Image)
} else {
  $targets = $all
}

function Get-ImageRef([string]$name, [string]$tag) {
  if ($DockerHubUser) {
    return "$DockerHubUser/$Repository/${name}:$tag"
  }
  return "$Repository/${name}:$tag"
}

$failed = @()
foreach ($name in $targets) {
  $ref = Get-ImageRef $name $Tag
  Write-Host "==> Building $ref" -ForegroundColor Cyan
  $dockerfile = "apps/$name/Dockerfile"
  if (-not (Test-Path $dockerfile)) { throw "Missing $dockerfile" }
  docker build -f $dockerfile -t $ref .
  if ($LASTEXITCODE -ne 0) {
    $failed += $name
    if ($FailFast) { throw "Build failed: $name" }
    continue
  }

  if (-not $SkipMigrate -and ($backends -contains $name)) {
    $mref = Get-ImageRef $name "$Tag-migrate"
    Write-Host "==> Building migrate $mref" -ForegroundColor Cyan
    docker build -f deploy/docker/prisma-migrate.Dockerfile `
      --build-arg SERVICE_NAME=$name `
      -t $mref .
    if ($LASTEXITCODE -ne 0) {
      $failed += "$name-migrate"
      if ($FailFast) { throw "Migrate image build failed: $name" }
    }
  }

  if ($Push) {
    Write-Host "==> Pushing $ref" -ForegroundColor Yellow
    docker push $ref
    if ($LASTEXITCODE -ne 0) { throw "Push failed: $ref (did you docker login?)" }
    if (-not $SkipMigrate -and ($backends -contains $name)) {
      $mref = Get-ImageRef $name "$Tag-migrate"
      docker push $mref
      if ($LASTEXITCODE -ne 0) { throw "Push failed: $mref" }
    }
  }
}

if ($failed.Count -gt 0) {
  throw "Failed images: $($failed -join ', ')"
}
Write-Host "OK: built $($targets.Count) app image(s) tag=$Tag" -ForegroundColor Green

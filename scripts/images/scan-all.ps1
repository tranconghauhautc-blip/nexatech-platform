<#
.SYNOPSIS
  Vulnerability scan for built images (trivy if available).
#>
[CmdletBinding()]
param([string]$Tag = $env:NEXATECH_IMAGE_TAG)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $root 'scripts/deployment/_common.ps1')
Import-NexaTechDeployEnv -Root $root

if (-not $Tag) { throw 'NEXATECH_IMAGE_TAG / -Tag required' }

$trivy = Get-Command trivy -ErrorAction SilentlyContinue
$outDir = Join-Path $root "deploy/checkpoints/scans-$Tag"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$images = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object { $_ -like "nexatech/*:$Tag" }
if (-not $trivy) {
  Write-Warning 'trivy not installed — scan skipped (install https://aquasecurity.github.io/trivy/)'
  @"
{ "tag": "$Tag", "status": "skipped", "reason": "trivy-not-found" }
"@ | Set-Content -Encoding utf8 -Path (Join-Path $outDir 'summary.json')
  Save-Checkpoint -Name 'images-scan' -Data @{ status = 'skipped'; outDir = $outDir }
  exit 0
}

foreach ($img in $images) {
  $safe = ($img -replace '[:/]', '_')
  $report = Join-Path $outDir "$safe.json"
  Write-Host "Scanning $img"
  & trivy image --format json --output $report $img
}

Save-Checkpoint -Name 'images-scan' -Data @{ status = 'ok'; outDir = $outDir }
Write-Host "Scan reports: $outDir"

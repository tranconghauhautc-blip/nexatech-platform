<#
.SYNOPSIS
  Seed ONLY required accounts/roles — no business catalog data.
  Credentials stay operator-provided; account list written to .secrets/seeded-accounts.txt
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

Write-Host 'Seeding required accounts only (no products/orders/stock).'
if ($DryRun) {
  Write-Host 'DRY-RUN: would run identity seed-required + security-guide setup'
  Save-Checkpoint -Name 'seed-required' -Data @{ dryRun = $true }
  exit 0
}

if (-not $env:NEXATECH_ALLOW_REQUIRED_SEED) {
  $env:NEXATECH_ALLOW_REQUIRED_SEED = 'YES'
}
if (-not $env:REQUIRED_SEED_PASSWORD -and $env:DEV_SEED_PASSWORD) {
  $env:REQUIRED_SEED_PASSWORD = $env:DEV_SEED_PASSWORD
}
if (-not $env:REQUIRED_SEED_PASSWORD) {
  throw 'REQUIRED_SEED_PASSWORD (or DEV_SEED_PASSWORD) must be set in the environment / .env.deploy.local — never commit it.'
}
if (-not $env:IDENTITY_DATABASE_URL) {
  throw 'IDENTITY_DATABASE_URL is required for seed-required'
}

$seedJs = Join-Path $root 'apps/identity-service/prisma/seed-required.cjs'
if (-not (Test-Path $seedJs)) {
  throw "Missing $seedJs"
}

Push-Location (Join-Path $root 'apps/identity-service')
try {
  node prisma/seed-required.cjs
  if ($LASTEXITCODE -ne 0) { throw 'seed-required.cjs failed' }
} finally {
  Pop-Location
}

$guide = Join-Path $root 'scripts/security-guide/setup.cjs'
if (Test-Path $guide) {
  Write-Host 'Ensuring Security Guide credentials (gitignored) exist...'
  node $guide
}

$out = Join-Path $root '.secrets/seeded-accounts.txt'
if (-not (Test-Path $out)) {
  throw "Expected $out after seed"
}

Save-Checkpoint -Name 'seed-required' -Data @{ accountsFile = '.secrets/seeded-accounts.txt' }
Write-Host "Credentials file (operator only): $out"

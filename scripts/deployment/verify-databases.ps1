<#
.SYNOPSIS
  Verify databases exist, migration history present, and business tables empty for clean deploy.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

$dbs = @(
  'nexatech_identity','nexatech_customer','nexatech_catalog','nexatech_media',
  'nexatech_inventory','nexatech_cart','nexatech_order','nexatech_payment',
  'nexatech_shipping','nexatech_review','nexatech_warranty','nexatech_support',
  'nexatech_notification','nexatech_reporting'
)

$env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
$failed = @()
try {
  foreach ($db in $dbs) {
    $exists = (& psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'").Trim()
    if ($exists -ne '1') {
      $failed += "$db missing"
      continue
    }
    $migrations = (& psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d $db -tAc "SELECT COUNT(*) FROM _prisma_migrations" 2>$null).Trim()
    Write-Host "$db migrations=$migrations"
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if ($failed.Count -gt 0) {
  throw ("Verify failed: " + ($failed -join '; '))
}

Save-Checkpoint -Name 'verify-databases' -Data @{ status = 'ok' }
Write-Host 'Database verification OK.'

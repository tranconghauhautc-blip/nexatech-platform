<#
.SYNOPSIS
  Backup all nexatech_* databases from POSTGRES_HOST. Verifies non-empty dump files.
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

if ([string]::IsNullOrWhiteSpace($env:POSTGRES_HOST)) {
  throw 'POSTGRES_HOST is required'
}

$hostSummary = @"
Target PostgreSQL
  Host: $($env:POSTGRES_HOST)
  Port: $($env:POSTGRES_PORT)
  Admin: $($env:POSTGRES_ADMIN_USER)
  SSL: $($env:POSTGRES_SSLMODE)
"@
Write-Host $hostSummary

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $root "deploy/checkpoints/backups/$stamp"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$dbs = @(
  'nexatech_identity','nexatech_customer','nexatech_catalog','nexatech_media',
  'nexatech_inventory','nexatech_cart','nexatech_order','nexatech_payment',
  'nexatech_shipping','nexatech_review','nexatech_warranty','nexatech_support',
  'nexatech_notification','nexatech_reporting'
)

$env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
try {
  foreach ($db in $dbs) {
    $file = Join-Path $outDir "$db.dump"
    if ($DryRun) {
      Write-Host "DRY-RUN: pg_dump $db -> $file"
      continue
    }
    Write-Host "Backing up $db ..."
    & pg_dump -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -Fc -f $file $db
    if (-not (Test-Path $file) -or (Get-Item $file).Length -le 0) {
      # DB may not exist yet on first deploy — record skip
      Write-Warning "Backup empty or missing for $db (may not exist yet)"
    } else {
      Write-Host "OK $($db): $((Get-Item $file).Length) bytes"
    }
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Save-Checkpoint -Name 'backup-databases' -Data @{ outDir = $outDir; dryRun = [bool]$DryRun }
Write-Host "Backups directory: $outDir"

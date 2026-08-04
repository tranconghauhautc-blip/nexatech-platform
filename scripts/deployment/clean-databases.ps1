<#
.SYNOPSIS
  DESTRUCTIVE clean of deployment databases. Requires explicit confirmation.
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [string]$ServerHost = $env:POSTGRES_HOST
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

if ([string]::IsNullOrWhiteSpace($ServerHost)) {
  throw 'POSTGRES_HOST / -ServerHost required'
}

Write-Host @"
=== TARGET SUMMARY (DESTRUCTIVE) ===
Host:   $ServerHost
Port:   $($env:POSTGRES_PORT)
Admin:  $($env:POSTGRES_ADMIN_USER)
Action: DROP + recreate nexatech_* application databases
Guard:  NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN
"@

if ($env:NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN -ne 'YES_I_UNDERSTAND') {
  Write-Host 'REFUSED: set NEXATECH_CONFIRM_DEPLOY_DATABASE_CLEAN=YES_I_UNDERSTAND in .env.deploy.local' -ForegroundColor Red
  exit 3
}

$dbs = @(
  'nexatech_identity','nexatech_customer','nexatech_catalog','nexatech_media',
  'nexatech_inventory','nexatech_cart','nexatech_order','nexatech_payment',
  'nexatech_shipping','nexatech_review','nexatech_warranty','nexatech_support',
  'nexatech_notification','nexatech_reporting'
)

$env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
try {
  foreach ($db in $dbs) {
    if ($DryRun) {
      Write-Host "DRY-RUN: DROP DATABASE IF EXISTS $db; CREATE DATABASE $db;"
      continue
    }
    Write-Host "Recreating $db ..."
    $sql = @"
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $db;
CREATE DATABASE $db;
"@
    $sql | & psql -h $ServerHost -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -v ON_ERROR_STOP=1
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Save-Checkpoint -Name 'clean-databases' -Data @{ host = $ServerHost; dryRun = [bool]$DryRun }
Write-Host 'Clean complete.'

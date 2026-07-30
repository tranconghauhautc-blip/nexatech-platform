# NexaTech PostgreSQL backup — pg_dump per DB + SHA-256 checksum.
# Default: DRY-RUN. Pass -Execute to run dumps.
#
# Usage:
#   .\scripts\backup-postgres.ps1
#   .\scripts\backup-postgres.ps1 -Execute
#   $env:PGHOST='192.168.4.208'; $env:PGPASSWORD='***'; .\scripts\backup-postgres.ps1 -Execute
#
# Env: PGHOST, PGPORT, PGUSER, PGPASSWORD, BACKUP_DIR, RETENTION_DAYS, NEXATECH_PG_DATABASES
# NEVER commit PGPASSWORD. NEVER restore to prod from unattended automation.

[CmdletBinding()]
param(
  [switch]$Execute,
  [switch]$DryRun,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
  @'
Usage: backup-postgres.ps1 [-Execute | -DryRun]

  -Execute   Run pg_dump and write checksum files (requires PGPASSWORD)
  -DryRun     Print planned actions only (default when -Execute not set)
  -Help       Show this help
'@
}

if ($Help) { Show-Usage; exit 0 }

$doExecute = $Execute.IsPresent
if ($DryRun.IsPresent) { $doExecute = $false }

$pgHost = if ($env:PGHOST) { $env:PGHOST } else { '192.168.4.208' }
$pgPort = if ($env:PGPORT) { $env:PGPORT } else { '5432' }
$pgUser = if ($env:PGUSER) { $env:PGUSER } else { 'nexatech_backup' }
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { '/var/backups/nexatech/postgres' }
$retentionDays = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 14 }

$defaultDbs = @(
  'nexatech_identity', 'nexatech_customer', 'nexatech_catalog', 'nexatech_media',
  'nexatech_inventory', 'nexatech_cart', 'nexatech_order', 'nexatech_payment',
  'nexatech_shipping', 'nexatech_review', 'nexatech_warranty', 'nexatech_support',
  'nexatech_notification', 'nexatech_reporting'
)

if ($env:NEXATECH_PG_DATABASES) {
  $databases = $env:NEXATECH_PG_DATABASES -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
} else {
  $databases = $defaultDbs
}

$ts = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dateDir = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
$outDir = Join-Path $backupDir $dateDir

function Write-Log([string]$Message) {
  Write-Host "[backup-postgres] $Message"
}

function Fail([string]$Message) {
  throw "[backup-postgres] ERROR: $Message"
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if ($doExecute -and -not $pgDump) { Fail 'pg_dump not found in PATH' }
if (-not $doExecute -and -not $pgDump) {
  Write-Log 'NOTE: pg_dump not in PATH (OK for dry-run; required for -Execute)'
}

if ($doExecute) {
  if (-not $env:PGPASSWORD) { Fail 'PGPASSWORD must be set for -Execute' }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
} else {
  Write-Log 'DRY-RUN mode (pass -Execute to write backups)'
}

Write-Log "Host=${pgHost}:${pgPort} User=${pgUser} Dir=${outDir} Retention=${retentionDays}d Databases=$($databases.Count)"

foreach ($db in $databases) {
  if (-not $db) { continue }
  $base = "${db}_${ts}.sql.gz"
  $dumpPath = Join-Path $outDir $base
  $sumPath = "${dumpPath}.sha256"

  if (-not $doExecute) {
    Write-Log "[dry-run] pg_dump -Fc $db | gzip > $dumpPath"
    Write-Log "[dry-run] sha256sum > $sumPath"
    continue
  }

  Write-Log "Dumping $db..."
  $env:PGHOST = $pgHost
  $env:PGPORT = $pgPort
  $env:PGUSER = $pgUser

  $tempFile = [System.IO.Path]::GetTempFileName()
  try {
    & pg_dump -h $pgHost -p $pgPort -U $pgUser -d $db --no-owner --no-acl -Fc -f $tempFile
    if ($LASTEXITCODE -ne 0) { Fail "pg_dump failed for database: $db" }

    $readStream = [System.IO.File]::OpenRead($tempFile)
    try {
      $writeStream = [System.IO.File]::Create($dumpPath)
      try {
        $gzip = New-Object System.IO.Compression.GzipStream($writeStream, [System.IO.Compression.CompressionMode]::Compress)
        try {
          $readStream.CopyTo($gzip)
        } finally {
          $gzip.Dispose()
        }
      } finally {
        $writeStream.Dispose()
      }
    } finally {
      $readStream.Dispose()
    }

    if (-not (Test-Path $dumpPath) -or (Get-Item $dumpPath).Length -eq 0) {
      Fail "Dump file empty: $dumpPath"
    }

    $hash = (Get-FileHash -Path $dumpPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $fileName = Split-Path $dumpPath -Leaf
    "${hash}  ${fileName}" | Set-Content -Path $sumPath -Encoding utf8NoBOM
    $bytes = (Get-Item $dumpPath).Length
    Write-Log "OK $db -> $dumpPath ($bytes bytes)"
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $tempFile
  }
}

if ($doExecute -and $retentionDays -gt 0) {
  Write-Log "Pruning backups older than $retentionDays days under $backupDir..."
  if (Test-Path $backupDir) {
    $cutoff = (Get-Date).AddDays(-$retentionDays)
    Get-ChildItem -Path $backupDir -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt $cutoff -and ($_.Extension -eq '.gz' -or $_.Name -like '*.sha256') } |
      ForEach-Object {
        Write-Log "Deleting $($_.FullName)"
        Remove-Item -Force $_.FullName
      }
  }
}

if (-not $doExecute) {
  Write-Log 'Dry-run complete. No files written.'
} else {
  Write-Log 'Backup complete.'
}

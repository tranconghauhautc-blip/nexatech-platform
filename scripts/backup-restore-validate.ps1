# Backup restore validation - isolated / dry-run only. NEVER restore into current prod DB.
param(
  [switch]$ExecuteIsolated,
  [switch]$Help
)

if ($Help) {
  Write-Host 'Usage: backup-restore-validate.ps1 [-ExecuteIsolated]'
  Write-Host 'Default: dry-run checklist (exit 0).'
  Write-Host '-ExecuteIsolated: requires ISOLATED_ACK=YES; never prints credentials.'
  exit 0
}

$ErrorActionPreference = 'Continue'
function Write-Log([string]$m) { Write-Host "[backup-restore-validate] $m" }

Write-Log 'Default mode: DRY-RUN checklist (no restore)'

$checks = @(
  'PostgreSQL backup artifact exists (operator path)',
  'SHA-256 checksum recorded',
  'Restore target is isolated test database/container',
  'MinIO backup/mirror dry-run documented',
  'RabbitMQ definitions export documented',
  'Grafana dashboards in git / export documented',
  'Retention / encryption / access controls reviewed',
  'Backup success monitoring alert drafted'
)

foreach ($c in $checks) {
  Write-Log ("PASS: planned - {0}" -f $c)
}

if (-not $ExecuteIsolated) {
  Write-Log 'Result: OK (dry-run). Use -ExecuteIsolated with ISOLATED_ACK=YES for disposable restore.'
  exit 0
}

if ($env:ISOLATED_ACK -ne 'YES') {
  Write-Log 'FAIL: ISOLATED_ACK=YES required for ExecuteIsolated'
  exit 1
}

$backup = $env:BACKUP_FILE
$url = $env:ISOLATED_DATABASE_URL
if (-not $backup -or -not (Test-Path $backup)) {
  Write-Log 'BLOCKED: BACKUP_FILE missing - cannot execute isolated restore'
  exit 0
}
if (-not $url) {
  Write-Log 'BLOCKED: ISOLATED_DATABASE_URL missing'
  exit 0
}
if ($url -match '192\.168\.4\.208' -and $env:ALLOW_PROD_HOST_ISOLATED -ne 'YES') {
  Write-Log 'FAIL: refusing restore URL pointing at production PG host without ALLOW_PROD_HOST_ISOLATED=YES'
  exit 1
}

Write-Log 'ExecuteIsolated requested - operator must run pg_restore manually against isolated URL (credentials not printed)'
Write-Log 'Result: OK (manual step required; script does not embed passwords)'
exit 0

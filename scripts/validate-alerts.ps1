# Static validate Prometheus alert YAML presence/structure (no live Prometheus required).
param([switch]$Help)
if ($Help) { Write-Host 'Usage: validate-alerts.ps1'; exit 0 }

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$file = Join-Path $root 'deploy/observability/alerts/nexatech-alerts.yaml'
function Write-Log([string]$m) { Write-Host "[validate-alerts] $m" }

if (-not (Test-Path $file)) {
  Write-Log "FAIL: missing $file"
  exit 1
}
$text = Get-Content $file -Raw
$required = @(
  'NexaTechServiceDown',
  'NexaTechHigh5xx',
  'NexaTechHighLatency',
  'NexaTechPodCrashLooping',
  'NexaTechPodPending',
  'NexaTechCPUHigh',
  'NexaTechMemoryHigh',
  'NexaTechPVCHigh',
  'NexaTechPostgresUnavailable',
  'NexaTechRabbitMQBacklog',
  'NexaTechRedisUnavailable',
  'NexaTechMinIOUnavailable',
  'NexaTechMigrationJobFailed',
  'NexaTechBackupFailed'
)
$fail = 0
foreach ($a in $required) {
  if ($text -match [regex]::Escape($a)) { Write-Log "PASS: alert $a" }
  else { Write-Log "FAIL: missing alert $a"; $fail++ }
}
if ($text -notmatch 'groups:') { Write-Log 'FAIL: missing groups'; $fail++ }
else { Write-Log 'PASS: groups present' }

if ($fail -gt 0) { Write-Log 'Result: FAIL'; exit 1 }
Write-Log 'Result: OK'
exit 0

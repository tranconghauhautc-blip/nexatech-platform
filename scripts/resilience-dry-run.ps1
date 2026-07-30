# Resilience dry-run - prints planned failure-mode checks; does NOT mutate cluster.
param(
  [switch]$Help
)

if ($Help) {
  Write-Host 'Usage: resilience-dry-run.ps1'
  Write-Host 'Prints planned resilience verification steps. No kubectl delete/kill.'
  exit 0
}

function Write-Log([string]$m) { Write-Host "[resilience-dry-run] $m" }

Write-Log 'DRY-RUN only - no cluster mutation'
$modes = @(
  'F01 PostgreSQL unavailable - expect ready fail / 503',
  'F03 Redis unavailable - expect auth degraded',
  'F05 RabbitMQ unavailable - expect sync OK, async lag',
  'F07 MinIO unavailable - expect media 503',
  'F09 Downstream REST timeout - expect checkout fail closed',
  'F13 Pod restart - expect transient 502 then heal',
  'F16 Image pull failure - expect ImagePullBackOff',
  'F17 Secret missing - expect crash/pending',
  'F19 Migration failure - expect Helm hook fail; cleanup Job',
  'F23 Kong upstream unavailable - expect 502 at edge'
)

$i = 0
foreach ($m in $modes) {
  $i++
  Write-Log ("PASS: planned check {0} - {1}" -f $i, $m)
}

Write-Log 'Operator may later run controlled chaos on staging only (never unattended prod).'
Write-Log 'See docs/RESILIENCE-TESTING.md for expectations table.'
Write-Log 'Result: OK (dry-run)'
exit 0

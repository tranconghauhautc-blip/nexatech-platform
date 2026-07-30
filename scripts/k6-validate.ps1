# Validate k6 scripts syntax (requires k6 in PATH). Offline-friendly.
param(
  [switch]$Help
)

if ($Help) {
  Write-Host 'Usage: k6-validate.ps1'
  exit 0
}

$ErrorActionPreference = 'Continue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

function Write-Log([string]$m) { Write-Host "[k6-validate] $m" }

$k6 = Get-Command k6 -ErrorAction SilentlyContinue
if (-not $k6) {
  Write-Log 'BLOCKED: k6 not in PATH --- syntax check skipped'
  exit 0
}

$fail = 0
Get-ChildItem -Path (Join-Path $root 'tests/k6/*.js') | ForEach-Object {
  $f = $_.FullName
  Write-Log "checking $f"
  $out = & k6 run --vus 1 --duration 1s -e BASE_URL=http://127.0.0.1:9 $f 2>&1 | Out-String
  if ($out -match 'SyntaxError|could not load JS|GoError.*javascript') {
    Write-Log "FAIL: $f"
    Write-Host ($out.Substring(0, [Math]::Min(500, $out.Length)))
    $fail++
  } else {
    Write-Log "PASS (parse ok / target may be down): $($_.Name)"
  }
}

if ($fail -gt 0) {
  Write-Log 'Result: FAIL'
  exit 1
}
Write-Log 'Result: OK'
exit 0


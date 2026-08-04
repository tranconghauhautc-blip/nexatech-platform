[CmdletBinding()]
param(
  [string]$Project = '',
  [switch]$Ui
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root
if (Test-Path .env.e2e) {
  Get-Content .env.e2e | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    Set-Item -Path ("Env:" + $line.Substring(0, $idx).Trim()) -Value $line.Substring($idx + 1).Trim()
  }
}
$args = @('test')
if ($Project) { $args += @('--project', $Project) }
if ($Ui) { $args += '--ui' }
pnpm exec playwright @args

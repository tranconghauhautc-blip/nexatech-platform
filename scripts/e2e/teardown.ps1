[CmdletBinding()]
param([switch]$Volumes)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root
$cmd = @('compose', '-f', 'infra/docker/docker-compose.e2e.yml', 'down')
if ($Volumes) { $cmd += '-v' }
docker @cmd
Write-Host 'E2E infra stopped.'

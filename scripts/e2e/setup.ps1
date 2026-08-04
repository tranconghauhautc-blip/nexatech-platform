[CmdletBinding()]
param(
  [switch]$WithApps
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
} else {
  Write-Warning 'Copy .env.e2e.example to .env.e2e first'
  Copy-Item .env.e2e.example .env.e2e
  Get-Content .env.e2e | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    Set-Item -Path ("Env:" + $line.Substring(0, $idx).Trim()) -Value $line.Substring($idx + 1).Trim()
  }
}

Write-Host 'Starting isolated E2E infra (postgres/redis/rabbitmq/minio/mailpit)...'
docker compose -f infra/docker/docker-compose.e2e.yml up -d --wait
if ($LASTEXITCODE -ne 0) {
  # Older compose without --wait
  docker compose -f infra/docker/docker-compose.e2e.yml up -d
  Start-Sleep -Seconds 12
}

docker compose -f infra/docker/docker-compose.e2e.yml ps

if ($WithApps) {
  Write-Host 'Starting application stack against E2E env overlays...'
  # Apps compose expects nexatech-dev network; for full isolated E2E prefer nx serve + TEST DB URLs
  # or a dedicated override. Documented path: infra healthy, then migrate/seed via scripts/e2e/seed.ps1
  # and run Playwright with STOREFRONT/ADMIN already up.
  Write-Warning 'WithApps: use existing healthy lab stack OR bring apps with e2e DATABASE_URL overrides. See docs/TESTING.md.'
}

Write-Host 'E2E infra ready.'

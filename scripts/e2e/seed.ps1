[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    Set-Item -Path ("Env:" + $line.Substring(0, $idx).Trim()) -Value $line.Substring($idx + 1).Trim()
  }
}

Import-DotEnv (Join-Path $root '.env.e2e.local')
Import-DotEnv (Join-Path $root '.env.e2e')

Write-Host 'Seeding E2E fixtures via official seed scripts against *_test databases only.'

function Assert-TestDatabaseUrl([string]$Name, [string]$Url) {
  if (-not $Url) { return $false }
  if ($Url -notmatch '_test') {
    throw "$Name must target an isolated test database (name contains _test). Refusing: $Url"
  }
  return $true
}

$identityUrl = $env:IDENTITY_TEST_DATABASE_URL
if (Assert-TestDatabaseUrl 'IDENTITY_TEST_DATABASE_URL' $identityUrl) {
  $env:IDENTITY_DATABASE_URL = $identityUrl
  if (-not $env:NEXATECH_ALLOW_REQUIRED_SEED) { $env:NEXATECH_ALLOW_REQUIRED_SEED = 'YES' }
  if (-not $env:NEXATECH_ALLOW_DEV_SEED) { $env:NEXATECH_ALLOW_DEV_SEED = 'YES' }
  if (-not $env:REQUIRED_SEED_PASSWORD -and $env:DEV_SEED_PASSWORD) {
    $env:REQUIRED_SEED_PASSWORD = $env:DEV_SEED_PASSWORD
  }
  $seed = Join-Path $root 'apps/identity-service/prisma/seed-required.cjs'
  if (Test-Path $seed) {
    Push-Location (Join-Path $root 'apps/identity-service')
    try {
      npx prisma migrate deploy
      if ($LASTEXITCODE -ne 0) { throw 'identity migrate deploy failed' }
      node prisma/seed-required.cjs
      if ($LASTEXITCODE -ne 0) { throw 'identity seed-required failed' }
    } finally {
      Pop-Location
    }
  } else {
    Write-Warning 'seed-required.cjs missing — create E2E accounts via registration API in Playwright fixtures'
  }
} else {
  Write-Warning 'IDENTITY_TEST_DATABASE_URL missing — skip identity seed'
}

# Optional customer seed against test DB only
$customerUrl = $env:CUSTOMER_TEST_DATABASE_URL
if (Assert-TestDatabaseUrl 'CUSTOMER_TEST_DATABASE_URL' $customerUrl) {
  $env:CUSTOMER_DATABASE_URL = $customerUrl
  $customerSeed = Join-Path $root 'scripts/seed-customers.cjs'
  if (Test-Path $customerSeed) {
    Write-Host 'Running seed-customers against CUSTOMER_TEST_DATABASE_URL...'
    $prevNodeEnv = $env:NODE_ENV
    $env:NODE_ENV = 'development'
    try {
      node $customerSeed
      if ($LASTEXITCODE -ne 0) { throw 'seed-customers failed' }
    } finally {
      if ($null -ne $prevNodeEnv) { $env:NODE_ENV = $prevNodeEnv }
      else { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }
    }
  }
}

Write-Host 'E2E seed step finished. Catalog/inventory fixtures: pnpm seed:catalog / seed:inventory / seed:pickup-stores against *_test URLs.'

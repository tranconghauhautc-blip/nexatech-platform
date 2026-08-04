[CmdletBinding()]
param()
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
  $seed = Join-Path $root 'apps/identity-service/prisma/seed-required.ts'
  if (Test-Path $seed) {
    Push-Location (Join-Path $root 'apps/identity-service')
    try {
      npx prisma migrate deploy
      if ($LASTEXITCODE -ne 0) { throw 'identity migrate deploy failed' }
      npx ts-node --transpile-only prisma/seed-required.ts
      if ($LASTEXITCODE -ne 0) { throw 'identity seed-required failed' }
    } finally {
      Pop-Location
    }
  } else {
    Write-Warning 'seed-required.ts missing — create E2E accounts via registration API in Playwright fixtures'
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
    node $customerSeed
  }
}

Write-Host 'E2E seed step finished. Business catalog/orders are created by Playwright fixtures, not deploy seeds.'

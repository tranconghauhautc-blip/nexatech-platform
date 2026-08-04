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

function Assert-TestUrl([string]$Name, [string]$Url) {
  if (-not $Url) { throw "Missing $Name" }
  if ($Url -notmatch '_test') { throw "$Name must target *_test database: $Url" }
}

$services = @(
  @{ Name = 'identity-service'; Env = 'IDENTITY_TEST_DATABASE_URL'; Runtime = 'IDENTITY_DATABASE_URL' },
  @{ Name = 'customer-service'; Env = 'CUSTOMER_TEST_DATABASE_URL'; Runtime = 'CUSTOMER_DATABASE_URL' },
  @{ Name = 'catalog-service'; Env = 'CATALOG_TEST_DATABASE_URL'; Runtime = 'CATALOG_DATABASE_URL' },
  @{ Name = 'media-service'; Env = 'MEDIA_TEST_DATABASE_URL'; Runtime = 'MEDIA_DATABASE_URL' },
  @{ Name = 'inventory-service'; Env = 'INVENTORY_TEST_DATABASE_URL'; Runtime = 'INVENTORY_DATABASE_URL' },
  @{ Name = 'cart-service'; Env = 'CART_TEST_DATABASE_URL'; Runtime = 'CART_DATABASE_URL' },
  @{ Name = 'order-service'; Env = 'ORDER_TEST_DATABASE_URL'; Runtime = 'ORDER_DATABASE_URL' },
  @{ Name = 'payment-service'; Env = 'PAYMENT_TEST_DATABASE_URL'; Runtime = 'PAYMENT_DATABASE_URL' },
  @{ Name = 'shipping-service'; Env = 'SHIPPING_TEST_DATABASE_URL'; Runtime = 'SHIPPING_DATABASE_URL' },
  @{ Name = 'review-service'; Env = 'REVIEW_TEST_DATABASE_URL'; Runtime = 'REVIEW_DATABASE_URL' },
  @{ Name = 'warranty-service'; Env = 'WARRANTY_TEST_DATABASE_URL'; Runtime = 'WARRANTY_DATABASE_URL' },
  @{ Name = 'support-service'; Env = 'SUPPORT_TEST_DATABASE_URL'; Runtime = 'SUPPORT_DATABASE_URL' },
  @{ Name = 'notification-service'; Env = 'NOTIFICATION_TEST_DATABASE_URL'; Runtime = 'NOTIFICATION_DATABASE_URL' },
  @{ Name = 'reporting-service'; Env = 'REPORTING_TEST_DATABASE_URL'; Runtime = 'REPORTING_DATABASE_URL' }
)

foreach ($svc in $services) {
  $url = [Environment]::GetEnvironmentVariable($svc.Env)
  Assert-TestUrl $svc.Env $url
  Set-Item -Path ("Env:" + $svc.Runtime) -Value $url
  Write-Host "migrate $($svc.Name)"
  Push-Location (Join-Path $root "apps/$($svc.Name)")
  try {
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "migrate failed for $($svc.Name)" }
  } finally {
    Pop-Location
  }
}

Write-Host 'E2E migrations complete.'

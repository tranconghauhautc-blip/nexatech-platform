# Shared helpers for deployment scripts. Dot-source from sibling scripts.
$ErrorActionPreference = 'Stop'

function Import-NexaTechDeployEnv {
  param([string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path)
  $envFile = Join-Path $Root '.env.deploy.local'
  if (-not (Test-Path $envFile)) {
    Write-Warning ".env.deploy.local missing — copy from .env.deploy.local.example"
    return
  }
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
  }
}

function Get-MissingExternalInputs {
  $required = @(
    'KUBECONFIG',
    'KONG_NODE_NAME',
    'POSTGRES_HOST',
    'POSTGRES_ADMIN_USER',
    'POSTGRES_ADMIN_PASSWORD',
    'CONTAINER_REGISTRY_URL',
    'CONTAINER_REGISTRY_USERNAME',
    'CONTAINER_REGISTRY_TOKEN',
    'METALLB_ADDRESS_POOL'
  )
  $missing = @()
  foreach ($name in $required) {
    $val = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($val)) {
      # KUBECONFIG may be satisfied by default ~/.kube/config
      if ($name -eq 'KUBECONFIG') {
        $defaultKube = Join-Path $HOME '.kube/config'
        if (Test-Path $defaultKube) { continue }
        if (Get-Command kubectl -ErrorAction SilentlyContinue) {
          $ctx = kubectl config current-context 2>$null
          if ($ctx) { continue }
        }
      }
      # KONG_NODE_NAME may use KONG_NODE_IP
      if ($name -eq 'KONG_NODE_NAME' -and -not [string]::IsNullOrWhiteSpace($env:KONG_NODE_IP)) { continue }
      $missing += $name
    }
  }
  return $missing
}

function Write-BlockedExternalInput {
  param([string[]]$Missing, [string]$Checkpoint)
  Write-Host ''
  Write-Host 'BLOCKED_EXTERNAL_INPUT' -ForegroundColor Red
  Write-Host "Checkpoint: $Checkpoint"
  Write-Host 'Missing variables:'
  foreach ($m in $Missing) {
    Write-Host "  - $m"
  }
  Write-Host ''
  Write-Host 'Enter values in: .env.deploy.local'
  Write-Host "Resume: pwsh -File scripts/deployment/resume-from-checkpoint.ps1 -Checkpoint $Checkpoint"
}

function Save-Checkpoint {
  param(
    [string]$Name,
    [hashtable]$Data,
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
  )
  $dir = Join-Path $Root 'deploy/checkpoints'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $payload = [ordered]@{
    checkpoint = $Name
    recordedAt = (Get-Date -Format o)
  }
  foreach ($k in $Data.Keys) { $payload[$k] = $Data[$k] }
  $path = Join-Path $dir "$Name.json"
  ($payload | ConvertTo-Json -Depth 8) | Set-Content -Encoding utf8 -Path $path
  Write-Host "Checkpoint written: $path"
}

function Assert-NoSecretEcho {
  param([string]$Text)
  if ($Text -match 'PASSWORD|TOKEN|SECRET|APP_PASSWORD') {
    throw 'Refusing to print secret-bearing text to logs'
  }
}

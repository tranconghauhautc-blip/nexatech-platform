<#
.SYNOPSIS
  Orchestrate NexaTech final deploy sequence. Stops with BLOCKED_EXTERNAL_INPUT if required vars missing.
  Does NOT bypass database clean confirmation guard.
#>
[CmdletBinding()]
param(
  [string]$FromCheckpoint = '00-baseline',
  [switch]$SkipImageBuild,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

function Step([string]$id, [string]$name, [scriptblock]$action) {
  Write-Host "`n==> [$id] $name" -ForegroundColor Cyan
  if ($DryRun) {
    Write-Host "DRY-RUN: would execute $name"
    Save-Checkpoint -Name $id -Data @{ status = 'dry-run'; name = $name }
    return
  }
  & $action
  Save-Checkpoint -Name $id -Data @{ status = 'ok'; name = $name }
}

$missing = Get-MissingExternalInputs
if ($missing.Count -gt 0) {
  Write-BlockedExternalInput -Missing $missing -Checkpoint $FromCheckpoint
  Save-Checkpoint -Name 'blocked-external-input' -Data @{
    missing = $missing
    resumeCommand = "pwsh -File scripts/deployment/resume-from-checkpoint.ps1 -Checkpoint $FromCheckpoint"
  }
  exit 2
}

if ($env:KUBECONFIG) { $env:KUBECONFIG = $env:KUBECONFIG }

Step '01-cluster-audit' 'Audit Kubernetes cluster' {
  kubectl get nodes -o wide
  kubectl get storageclass
  kubectl get ns
}

Step '02-label-nodes' 'Label app nodes and taint Kong node' {
  & (Join-Path $PSScriptRoot 'label-nodes.ps1')
}

Step '03-metallb' 'Install MetalLB if no LoadBalancer' {
  $hasLb = kubectl get svc -A -o json | ConvertFrom-Json |
    Select-Object -ExpandProperty items |
    Where-Object { $_.spec.type -eq 'LoadBalancer' -and $_.status.loadBalancer.ingress }
  if (-not $hasLb -and $env:METALLB_ADDRESS_POOL) {
    Write-Host "Applying MetalLB namespace + IP pool $($env:METALLB_ADDRESS_POOL)"
    kubectl apply -f deploy/metallb/namespace.yaml
    # Operator install is environment-specific; document if metallb CRDs missing
    $tpl = Get-Content deploy/metallb/ipaddresspool.yaml.tpl -Raw
    $rendered = $tpl.Replace('${METALLB_ADDRESS_POOL}', $env:METALLB_ADDRESS_POOL)
    $tmp = Join-Path $env:TEMP 'nexatech-metallb-pool.yaml'
    Set-Content -Path $tmp -Value $rendered -Encoding utf8
    kubectl apply -f $tmp
  } else {
    Write-Host 'LoadBalancer capability detected or pool unset — skipping MetalLB apply'
  }
}

Step '04-registry' 'Configure registry login' {
  $reg = $env:CONTAINER_REGISTRY_URL
  docker login $reg -u $env:CONTAINER_REGISTRY_USERNAME -p $env:CONTAINER_REGISTRY_TOKEN
}

if (-not $SkipImageBuild) {
  Step '05-images' 'Build, scan, push immutable images' {
    & (Join-Path $root 'scripts/images/build-all.ps1')
    & (Join-Path $root 'scripts/images/scan-all.ps1')
    & (Join-Path $root 'scripts/images/push-all.ps1')
  }
}

Step '06-postgres-check' 'Confirm PostgreSQL connectivity' {
  Write-Host "Target PostgreSQL host: $($env:POSTGRES_HOST):$($env:POSTGRES_PORT)"
  # Connectivity probe without echoing password
  $env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
  psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -c 'SELECT version();' | Out-Host
  Remove-Item Env:PGPASSWORD
}

Step '07-backup' 'Backup deployment databases' {
  & (Join-Path $PSScriptRoot 'backup-databases.ps1')
}

Step '08-clean' 'Clean deployment databases (confirmation required)' {
  & (Join-Path $PSScriptRoot 'clean-databases.ps1')
}

Step '09-create-dbs' 'Create service databases and users' {
  & (Join-Path $PSScriptRoot 'create-databases.ps1')
}

Step '10-platform' 'Deploy Redis, RabbitMQ, MinIO, Mailpit' {
  helm upgrade --install nexatech deploy/helm/nexatech `
    -n $env:HELM_NAMESPACE --create-namespace `
    -f deploy/environments/staging/values.yaml `
    --set global.postgresql.host=$env:POSTGRES_HOST `
    --wait --timeout 15m
}

Step '11-kong' 'Deploy Kong on dedicated node' {
  helm upgrade --install $env:HELM_KONG_RELEASE_NAME deploy/helm/kong `
    -n $env:HELM_NAMESPACE `
    -f deploy/environments/staging/values.yaml `
    --wait --timeout 10m
}

Step '12-migrate' 'Run migration Jobs' {
  & (Join-Path $PSScriptRoot 'migrate-all.ps1')
}

Step '13-seed' 'Run required seed Jobs' {
  & (Join-Path $PSScriptRoot 'seed-required.ps1')
}

Step '14-verify' 'Verify databases and rollouts' {
  & (Join-Path $PSScriptRoot 'verify-databases.ps1')
  kubectl -n $env:HELM_NAMESPACE rollout status deploy --timeout=10m
  kubectl -n $env:HELM_NAMESPACE get pods -o wide
}

Write-Host "`nDeploy sequence completed through verify. Continue with Kong smoke + Playwright E2E." -ForegroundColor Green
Save-Checkpoint -Name '15-ready-for-acceptance' -Data @{ status = 'ok' }

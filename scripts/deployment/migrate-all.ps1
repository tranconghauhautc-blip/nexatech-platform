<#
.SYNOPSIS
  Forward-only Prisma migrations for all 14 services (local or via K8s Jobs).

  Kubernetes mode uses Helm chart Jobs named `{service}-migrate`
  (see deploy/helm/nexatech/templates/migrations-job.yaml), NOT CronJobs.
#>
[CmdletBinding()]
param(
  [ValidateSet('local','kubernetes')]
  [string]$Mode = 'kubernetes',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

$services = @(
  'identity-service','customer-service','catalog-service','media-service',
  'inventory-service','cart-service','order-service','payment-service',
  'shipping-service','review-service','warranty-service','support-service',
  'notification-service','reporting-service'
)

function Get-MigrateJobName([string]$ServiceName) {
  # Chart template: {{ printf "%s-migrate" $service.name }} where name is identity-service etc.
  return "$ServiceName-migrate"
}

if ($Mode -eq 'kubernetes') {
  $ns = if ($env:HELM_NAMESPACE) { $env:HELM_NAMESPACE } else { 'nexatech' }
  foreach ($svc in $services) {
    $chartJob = Get-MigrateJobName $svc
    $runJob = "migrate-run-$($svc.Replace('-service',''))"
    Write-Host "Migration Job from chart template: $chartJob -> run as $runJob"
    if ($DryRun) { continue }

    # Prefer re-running a completed Helm-hook Job by cloning its pod template.
    $jobJson = kubectl -n $ns get job $chartJob -o json 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $jobJson) {
      Write-Warning "Job $chartJob not found in namespace $ns. Run helm upgrade with migrations enabled, or use -Mode local."
      continue
    }

    kubectl -n $ns delete job $runJob --ignore-not-found | Out-Null

    $tmp = [System.IO.Path]::GetTempFileName()
    try {
      $jobJson |
        ConvertFrom-Json |
        ForEach-Object {
          $_.metadata = @{
            name = $runJob
            namespace = $ns
            labels = @{ 'app.kubernetes.io/component' = 'migration'; 'nexatech.io/service' = $svc }
            annotations = @{ 'nexatech.io/migration-source' = $chartJob }
          }
          # Strip status / uid / resourceVersion for create
          $_.PSObject.Properties.Remove('status')
          if ($_.metadata.PSObject.Properties['uid']) { $_.metadata.PSObject.Properties.Remove('uid') }
          if ($_.metadata.PSObject.Properties['resourceVersion']) { $_.metadata.PSObject.Properties.Remove('resourceVersion') }
          if ($_.metadata.PSObject.Properties['creationTimestamp']) { $_.metadata.PSObject.Properties.Remove('creationTimestamp') }
          if ($_.spec.selector) { $_.spec.PSObject.Properties.Remove('selector') }
          if ($_.spec.template.metadata.labels) {
            # Allow Job controller to set unique labels
            $_.spec.template.metadata.labels = @{ 'nexatech.io/migration' = $svc }
          }
          $_ | ConvertTo-Json -Depth 100 | Set-Content -Path $tmp -Encoding utf8
        }
      kubectl -n $ns apply -f $tmp
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to create migration job $runJob from $chartJob"
      }
      kubectl -n $ns wait --for=condition=complete "job/$runJob" --timeout=600s
      if ($LASTEXITCODE -ne 0) {
        kubectl -n $ns logs "job/$runJob" --tail=200
        throw "Migration job $runJob did not complete"
      }
    } finally {
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
    }
  }
} else {
  foreach ($svc in $services) {
    $dir = Join-Path $root "apps/$svc"
    Write-Host "prisma migrate deploy: $svc"
    if ($DryRun) { continue }
    Push-Location $dir
    try {
      npx prisma migrate deploy
      if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed for $svc" }
    } finally {
      Pop-Location
    }
  }
}

Save-Checkpoint -Name 'migrate-all' -Data @{ mode = $Mode; dryRun = [bool]$DryRun }
Write-Host 'Migrations complete.'

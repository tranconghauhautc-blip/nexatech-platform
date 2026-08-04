<#
.SYNOPSIS
  Label application nodes and taint the dedicated Kong node.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

Write-Host 'Current nodes:'
kubectl get nodes -o wide

$appNodes = @()
if ($env:K8S_APP_NODE_NAMES) {
  $appNodes = $env:K8S_APP_NODE_NAMES.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

$kongNode = $env:KONG_NODE_NAME
if (-not $kongNode -and $env:KONG_NODE_IP) {
  $kongNode = (kubectl get nodes -o json | ConvertFrom-Json).items |
    Where-Object {
      $_.status.addresses | Where-Object { $_.address -eq $env:KONG_NODE_IP }
    } |
    Select-Object -First 1 -ExpandProperty metadata |
    Select-Object -ExpandProperty name
}

if (-not $kongNode) { throw 'KONG_NODE_NAME or KONG_NODE_IP required' }

foreach ($n in $appNodes) {
  Write-Host "Labeling app node: $n"
  kubectl label node $n 'nexatech.io/role=app' --overwrite
}

Write-Host "Labeling + tainting Kong node: $kongNode"
kubectl label node $kongNode 'nexatech.io/role=kong' --overwrite
kubectl taint node $kongNode 'dedicated=kong:NoSchedule' --overwrite

kubectl get nodes --show-labels
Save-Checkpoint -Name 'label-nodes' -Data @{ kongNode = $kongNode; appNodes = $appNodes }

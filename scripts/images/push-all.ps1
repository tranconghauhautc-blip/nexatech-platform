<#
.SYNOPSIS
  Push all tagged images for NEXATECH_IMAGE_TAG to the container registry.
#>
[CmdletBinding()]
param([string]$Tag = $env:NEXATECH_IMAGE_TAG)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $root 'scripts/deployment/_common.ps1')
Import-NexaTechDeployEnv -Root $root

if (-not $Tag) { throw 'NEXATECH_IMAGE_TAG / -Tag required' }
$registry = $env:CONTAINER_REGISTRY_URL
$ns = if ($env:CONTAINER_REGISTRY_NAMESPACE) { $env:CONTAINER_REGISTRY_NAMESPACE } else { 'nexatech' }
if (-not $registry) { throw 'CONTAINER_REGISTRY_URL required' }

Write-Host "Logging into $registry"
docker login $registry -u $env:CONTAINER_REGISTRY_USERNAME -p $env:CONTAINER_REGISTRY_TOKEN | Out-Null

$images = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object {
  $_ -like "$registry/$ns/*:$Tag*" -or $_ -like "nexatech/*:$Tag*"
}
foreach ($img in $images) {
  if ($img -like 'nexatech/*') {
    $name = ($img -split '/')[1]
    $remote = "$registry/$ns/$name"
    docker tag $img $remote
    docker push $remote
  } else {
    docker push $img
  }
  if ($LASTEXITCODE -ne 0) { throw "Push failed: $img" }
}

Save-Checkpoint -Name 'images-push' -Data @{ tag = $Tag; registry = $registry }
Write-Host 'Push complete.'

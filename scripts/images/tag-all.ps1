<#
.SYNOPSIS
  Retag local nexatech/* images to registry namespace using NEXATECH_IMAGE_TAG.
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

$images = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object { $_ -like "nexatech/*:$Tag*" }
foreach ($local in $images) {
  $name = ($local -split '/')[1]
  $remote = "$registry/$ns/$name"
  Write-Host "Tag $local -> $remote"
  docker tag $local $remote
}

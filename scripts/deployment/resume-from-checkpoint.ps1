<#
.SYNOPSIS
  Resume NexaTech deployment from a named checkpoint after owner fills .env.deploy.local.
.EXAMPLE
  pwsh -File scripts/deployment/resume-from-checkpoint.ps1 -Checkpoint 00-baseline
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Checkpoint
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
Set-Location $root
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

$cpPath = Join-Path $root "deploy/checkpoints/$Checkpoint.json"
if (-not (Test-Path $cpPath)) {
  throw "Checkpoint not found: $cpPath"
}

Write-Host "Resuming from checkpoint: $Checkpoint"
Get-Content $cpPath | Write-Host

$missing = Get-MissingExternalInputs
if ($missing.Count -gt 0) {
  Write-BlockedExternalInput -Missing $missing -Checkpoint $Checkpoint
  exit 2
}

# Hand off to full sequence from this checkpoint
& (Join-Path $PSScriptRoot 'deploy-sequence.ps1') -FromCheckpoint $Checkpoint

# Scan repository for accidental secret/password leaks.
# Excludes examples, placeholders, and documentation patterns.
#
# Usage:
#   .\scripts\check-secret-leak.ps1
#   .\scripts\check-secret-leak.ps1 -Path .
#
# Exit 0 = clean, 1 = potential leaks found

[CmdletBinding()]
param(
  [string]$Path = '',
  [switch]$Help
)

$ErrorActionPreference = 'Continue'

function Show-Usage {
  @'
Usage: check-secret-leak.ps1 [-Path DIR]

Scans for high-confidence secret patterns. Skips examples and placeholders.
'@
}

if ($Help) { Show-Usage; exit 0 }

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$scanPath = if ($Path) { Resolve-Path $Path } else { $root }

$fail = $false

function Write-Log([string]$Message) { Write-Host "[check-secret-leak] $Message" }

function Test-SafeLine([string]$Line) {
  $markers = @(
    'CHANGE_ME', 'REPLACE', 'PASSWORD', 'changeme', 'change-me',
    'YOUR_', 'EXAMPLE', 'secret-values.example', '***', '<redacted>'
  )
  foreach ($m in $markers) {
    if ($Line -match [regex]::Escape($m)) { return $true }
  }
  if ($Line -match '^\s*#') { return $true }
  return $false
}

$excludeDirs = @(
  '.git', 'node_modules', 'dist', '.nx'
)

$extensionsSkip = @(
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2'
)

$patterns = @(
  @{ Name = 'postgres-real-host'; Regex = 'postgresql://nexatech_[a-z_]+:[^@"\s]+@192\.168\.' },
  @{ Name = 'pgpassword-env'; Regex = 'PGPASSWORD\s*=\s*\S+' },
  @{ Name = 'private-key'; Regex = 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY' },
  @{ Name = 'aws-key'; Regex = 'AKIA[0-9A-Z]{16}' },
  @{ Name = 'long-secret-assign'; Regex = 'secret[_-]?key\s*=\s*["''][A-Za-z0-9+/=]{20,}["'']' }
)

Write-Log "Scanning $scanPath ..."

$files = Get-ChildItem -Path $scanPath -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $rel = $_.FullName.Substring($scanPath.Path.Length).TrimStart('\', '/')
    $skip = $false
    foreach ($d in $excludeDirs) {
      if ($rel -match "(^|[\\/])$([regex]::Escape($d))([\\/]|$)") { $skip = $true; break }
    }
    if ($skip) { return $false }
    if ($extensionsSkip -contains $_.Extension.ToLowerInvariant()) { return $false }
    if ($_.Name -in @('pnpm-lock.yaml', 'check-secret-leak.ps1', 'check-secret-leak.sh')) { return $false }
    return $true
  }

foreach ($file in $files) {
  $lineNum = 0
  foreach ($line in [System.IO.File]::ReadLines($file.FullName)) {
    $lineNum++
    if (Test-SafeLine $line) { continue }

    foreach ($p in $patterns) {
      if ($line -match $p.Regex) {
        Write-Log "POTENTIAL LEAK ($($p.Name)): $($file.FullName):$lineNum"
        Write-Log "  $line"
        $fail = $true
        break
      }
    }

    if ($line -match 'postgresql://' -and $line -notmatch 'changeme|PASSWORD|REPLACE|CHANGE_ME|\*\*\*') {
      if ($line -match '://[^:]+:([^@]+)@') {
        $pwd = $Matches[1]
        if ($pwd.Length -ge 12 -and $pwd -notmatch 'change-me|your-password') {
          Write-Log "POTENTIAL LEAK (postgres-url): $($file.FullName):$lineNum"
          Write-Log "  (connection string with non-placeholder password)"
          $fail = $true
        }
      }
    }
  }
}

# Tracked .env files
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
  Push-Location $root
  try {
    Get-ChildItem -Path $scanPath -Recurse -Filter '.env*' -File -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -match '\.(example|sample|template)$') { return }
      $rel = $_.FullName.Substring($root.Path.Length).TrimStart('\', '/')
      & git ls-files --error-unmatch $rel 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        Write-Log "TRACKED ENV FILE: $rel (should be gitignored)"
        $fail = $true
      }
    }
  } finally {
    Pop-Location
  }
}

if (-not $fail) {
  Write-Log 'OK: no high-confidence secret leaks detected'
  exit 0
}

Write-Log 'FAILED: review findings above — remove or rotate exposed secrets'
exit 1

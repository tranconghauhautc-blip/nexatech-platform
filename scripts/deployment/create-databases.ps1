<#
.SYNOPSIS
  Create one database + least-privilege user per microservice.
  Passwords loaded from .secrets/database-credentials.env (never printed).
#>
[CmdletBinding()]
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
. (Join-Path $PSScriptRoot '_common.ps1')
Import-NexaTechDeployEnv -Root $root

$credFile = Join-Path $root '.secrets/database-credentials.env'
if (-not (Test-Path $credFile)) { throw "Missing $credFile" }

$creds = @{}
Get-Content $credFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }
  $creds[$line.Substring(0, $idx).Trim()] = $line.Substring($idx + 1).Trim()
}

$services = @(
  'identity','customer','catalog','media','inventory','cart','order',
  'payment','shipping','review','warranty','support','notification','reporting'
)

$env:PGPASSWORD = $env:POSTGRES_ADMIN_PASSWORD
try {
  foreach ($s in $services) {
    $key = $s.ToUpper()
    $db = $creds["NEXATECH_${key}_DB_NAME"]
    $user = $creds["NEXATECH_${key}_DB_USER"]
    $pass = $creds["NEXATECH_${key}_DB_PASSWORD"]
    if (-not $db -or -not $user -or -not $pass) { throw "Incomplete credentials for $s" }
    Write-Host "Ensuring database $db and user $user"
    if ($DryRun) { continue }
    $passSql = $pass.Replace("'", "''")
    # 1) Role must exist before CREATE DATABASE ... OWNER
    $roleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$user') THEN
    CREATE ROLE $user LOGIN PASSWORD '$passSql';
  ELSE
    ALTER ROLE $user WITH PASSWORD '$passSql';
  END IF;
END
`$`$;
"@
    $roleSql | & psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -v ON_ERROR_STOP=1 | Out-Null
    # 2) Ensure database exists with correct owner
    $exists = (& psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'").Trim()
    if ($exists -ne '1') {
      & psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d postgres -c "CREATE DATABASE $db OWNER $user;"
    }
    $grant = @"
REVOKE ALL ON DATABASE $db FROM PUBLIC;
GRANT CONNECT ON DATABASE $db TO $user;
GRANT ALL ON SCHEMA public TO $user;
ALTER DATABASE $db OWNER TO $user;
"@
    $grant | & psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_ADMIN_USER -d $db -v ON_ERROR_STOP=1 | Out-Null
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Save-Checkpoint -Name 'create-databases' -Data @{ dryRun = [bool]$DryRun }
Write-Host 'Databases and users ready.'

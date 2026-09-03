[CmdletBinding()]
param(
    [string]$VaultPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$syncScript = Join-Path $projectRoot 'scripts\sync-publish.mjs'

Push-Location $projectRoot
try {
    $arguments = @($syncScript)
    if ($VaultPath) {
        $arguments += @('--vault', $VaultPath)
    }

    & node @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Safe sync failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

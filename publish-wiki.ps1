[CmdletBinding()]
param(
    [switch]$NoGit,
    [string]$CommitMessage = "Update knowledge base"
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments
    )
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed with exit code $LASTEXITCODE"
    }
}

Push-Location $projectRoot
try {
    & (Join-Path $projectRoot 'sync-obsidian-to-quartz.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Sync script failed' }

    Invoke-Checked node '.\scripts\security-scan.mjs'
    Invoke-Checked npm 'run' 'check'
    Invoke-Checked npx 'quartz' 'build'
    Invoke-Checked node '.\scripts\verify-private-samples.mjs'

    if ($NoGit) {
        Write-Host 'Local sync, privacy scan, and Quartz build passed. Git steps were skipped.'
        return
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.git'))) {
        throw 'Local checks passed, but this directory is not a Git repository.'
    }

    $origin = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($origin)) {
        throw 'Local checks passed, but no GitHub origin is configured.'
    }

    Invoke-Checked git 'status' '--short'
    Invoke-Checked git 'add' '-A'
    Invoke-Checked node '.\scripts\security-scan.mjs'

    & git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'There are no public-content changes to commit.'
        return
    }
    if ($LASTEXITCODE -ne 1) { throw 'Could not inspect the staged changes.' }

    Invoke-Checked git 'commit' '-m' $CommitMessage

    $branch = (& git branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) { throw 'Could not determine the current Git branch.' }

    & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' *> $null
    if ($LASTEXITCODE -eq 0) {
        Invoke-Checked git 'push'
    }
    else {
        Invoke-Checked git 'push' '-u' 'origin' $branch
    }
}
finally {
    Pop-Location
}

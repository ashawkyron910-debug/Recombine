$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

$status = git status --porcelain
if (-not $status) {
    Write-Host "No changes to push."
    exit 0
}

git add -A
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Auto-update: $timestamp"
git push origin HEAD

Write-Host "Pushed to GitHub."

& (Join-Path $repoRoot "scripts\restart-servers.ps1")

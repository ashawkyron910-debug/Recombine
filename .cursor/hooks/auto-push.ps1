$ErrorActionPreference = "SilentlyContinue"

# Read hook JSON from stdin (required by Cursor hooks)
$null = [Console]::In.ReadToEnd()

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { exit 0 }

Set-Location $repoRoot

$status = git status --porcelain
$pushed = $false

if ($status) {
    git add -A
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-update: $timestamp"
    git push origin HEAD 2>$null
    if ($LASTEXITCODE -eq 0) {
        $pushed = $true
    }
}

if ($pushed) {
    powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\restart-servers.ps1")
}

exit 0

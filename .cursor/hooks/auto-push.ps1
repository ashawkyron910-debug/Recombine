$ErrorActionPreference = "SilentlyContinue"

# Read hook JSON from stdin (required by Cursor hooks)
$null = [Console]::In.ReadToEnd()

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { exit 0 }

Set-Location $repoRoot

$status = git status --porcelain
if (-not $status) { exit 0 }

git add -A
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Auto-update: $timestamp"
git push origin HEAD 2>$null

exit 0

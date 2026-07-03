param(
    [int[]]$Ports = @(2052, 88, 8080)
)

$ErrorActionPreference = "SilentlyContinue"

$pidsFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".run\pids.json"
if (Test-Path $pidsFile) {
    $pids = Get-Content $pidsFile | ConvertFrom-Json
    foreach ($pid in @($pids.serverPid, $pids.clientPid)) {
        cmd /c "taskkill /PID $pid /T /F" 2>$null | Out-Null
    }
}

foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        if ($connection.OwningProcess) {
            cmd /c "taskkill /PID $($connection.OwningProcess) /T /F" 2>$null | Out-Null
        }
    }
}

Start-Sleep -Milliseconds 800

# Kill leftover serve/node listeners from prior runs
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in @(8080, 2052, 88, 3000, 64753) } |
    ForEach-Object {
        cmd /c "taskkill /PID $($_.OwningProcess) /T /F" 2>$null | Out-Null
    }

Start-Sleep -Milliseconds 500

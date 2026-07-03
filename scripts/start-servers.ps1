$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $repoRoot ".run"
$logDir = Join-Path $runDir "logs"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

& (Join-Path $PSScriptRoot "stop-servers.ps1")

$serverDir = Join-Path $repoRoot "RecombineServer"
$clientDir = Join-Path $repoRoot "RecombineClient"

$serverLog = Join-Path $logDir "server.log"
$clientLog = Join-Path $logDir "client.log"

$serverProc = Start-Process -FilePath "powershell.exe" `
    -WorkingDirectory $serverDir `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npm start 2>&1 | Out-File -FilePath '$serverLog' -Append" `
    -WindowStyle Hidden `
    -PassThru

$clientProc = Start-Process -FilePath "powershell.exe" `
    -WorkingDirectory $clientDir `
    -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "npx --yes serve -l 8080 --no-port-switching 2>&1 | Out-File -FilePath '$clientLog' -Append" `
    -WindowStyle Hidden `
    -PassThru

@{
    serverPid = $serverProc.Id
    clientPid = $clientProc.Id
    startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content (Join-Path $runDir "pids.json")

Write-Host "Game server: http://localhost:8080/#localhost (client) -> ws://localhost:2052 (server)"
Write-Host "Server PID: $($serverProc.Id) | Client PID: $($clientProc.Id)"
Write-Host "Logs: $logDir"

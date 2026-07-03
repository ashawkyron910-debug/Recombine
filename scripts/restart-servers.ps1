$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "stop-servers.ps1")
& (Join-Path $PSScriptRoot "start-servers.ps1")

Write-Host "Servers restarted."

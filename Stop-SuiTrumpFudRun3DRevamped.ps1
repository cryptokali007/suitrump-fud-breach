[CmdletBinding()]
param([int]$Port = 4182)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue

if (-not $connections) {
  Write-Host "No SuiTrump: FUD Breach listener found on port $Port."
  return
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
  $details = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
  $commandLine = [string]$details.CommandLine
  if ($commandLine -notlike "*$root*") {
    throw "PID $processId owns port $Port but does not belong to this project. Refusing to stop it."
  }
  Stop-Process -Id $processId -ErrorAction Stop
  Write-Host "Stopped SuiTrump: FUD Breach (PID $processId) on port $Port."
}

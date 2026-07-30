[CmdletBinding()]
param(
  [int]$Port = 4182,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = "http://127.0.0.1:$Port/"
$runDir = Join-Path $root ".run"
$stdoutLog = Join-Path $runDir "vite.stdout.log"
$stderrLog = Join-Path $runDir "vite.stderr.log"

function Get-Listener {
  Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Test-ExpectedApp {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.Content -match "SuiTrump: FUD Breach"
  }
  catch {
    return $false
  }
}

$listener = Get-Listener
if ($listener) {
  if (-not (Test-ExpectedApp)) {
    throw "Port $Port is already owned by another service. Refusing to hijack it."
  }
  Write-Host "SuiTrump: FUD Breach is already running at $url"
}
else {
  New-Item -ItemType Directory -Path $runDir -Force | Out-Null
  $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
  Write-Host "Starting SuiTrump: FUD Breach at $url"
  Start-Process -FilePath $npm `
    -ArgumentList @("run", "dev", "--", "--port", "$Port") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog | Out-Null

  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 250
    if (Test-ExpectedApp) { break }
  } while ((Get-Date) -lt $deadline)

  if (-not (Test-ExpectedApp)) {
    throw "Vite did not become ready within 20 seconds. Check $stdoutLog and $stderrLog."
  }
}

if ($NoBrowser) { return }

$browserCandidates = @(
  "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
  "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
  (Join-Path $env:LOCALAPPDATA "Mullvad\MullvadBrowser\Release\mullvadbrowser.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

if ($browserCandidates.Count -eq 0) {
  throw "Brave and Mullvad Browser were not found. Refusing to use the system browser because it may open Chrome."
}

Start-Process -FilePath $browserCandidates[0] -ArgumentList $url

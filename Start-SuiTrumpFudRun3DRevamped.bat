@echo off
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-SuiTrumpFudRun3DRevamped.ps1" %*
if errorlevel 1 pause

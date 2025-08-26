@echo off
setlocal
cd /d "%~dp0frontend"

if not exist node_modules (
  echo [frontend] installing deps...
  call npm.cmd install
)

call npm.cmd run dev
endlocal


@echo off
setlocal
cd /d "%~dp0"

start "mvp3-backend"  cmd /k "%~dp0start-backend.bat"
timeout /t 2 >nul
start "mvp3-frontend" cmd /k "%~dp0start-frontend.bat"
endlocal


@echo off
setlocal
rem ----- 配置端口（mvp3 用 5190）-----
set PORT=5190

rem ----- 先释放端口（如已有进程占用）-----
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1

rem ----- 切到 backend 目录（相对脚本所在目录）-----
cd /d "%~dp0backend"

rem ----- 第一次运行自动安装依赖 -----
if not exist node_modules (
  echo [backend] installing deps...
  call npm.cmd install
)

echo [mvp3-backend] : %PORT%
set PORT=%PORT%
call npm.cmd run dev
endlocal

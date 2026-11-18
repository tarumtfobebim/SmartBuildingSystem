
@echo off
setlocal EnableExtensions
title Smart Building System Launcher

:: ============================================
:: 1. Request Administrator Permission
:: ============================================

fltmc >nul 2>&1
if not "%errorlevel%"=="0" (
    echo Requesting Administrator permission...
    powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ============================================
:: 2. Set Project Directory
:: ============================================

set "PROJECT=%~dp0"
cd /d "%PROJECT%"

echo ============================================
echo       SMART BUILDING SYSTEM STARTUP
echo ============================================
echo.
echo Project: %PROJECT%
echo.

:: ============================================
:: 3. Check Required Files and Commands
:: ============================================

where pm2.cmd >nul 2>&1
if errorlevel 1 (
    echo ERROR: PM2 is not installed or not in PATH.
    echo Install using: npm install -g pm2
    pause
    exit /b 1
)

where node.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not found.
    pause
    exit /b 1
)

where node-red.cmd >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node-RED is not found.
    pause
    exit /b 1
)

if not exist "cloudflared.exe" (
    echo ERROR: cloudflared.exe is missing.
    pause
    exit /b 1
)

if not exist ".env" (
    echo ERROR: .env is missing.
    pause
    exit /b 1
)

if not exist "serviceAccountKey.json" (
    echo ERROR: Firebase serviceAccountKey.json is missing.
    pause
    exit /b 1
)

if not exist "scripts\proxy-server.js" goto missing
if not exist "scripts\update-url.js" goto missing
if not exist "scripts\deltaohm.js" goto missing

:: ============================================
:: 4. Start Node-RED in Separate CMD
:: ============================================

echo [1/5] Starting Node-RED...

start "SmartBuilding - Node-RED" cmd /k "node-red"

timeout /t 5 /nobreak >nul

:: ============================================
:: 5. Start PM2 Proxy Server
:: ============================================

echo [2/5] Starting Proxy Server...

call pm2 describe proxy-server >nul 2>&1

if errorlevel 1 (
    call pm2 start "scripts\proxy-server.js" --name proxy-server
) else (
    call pm2 restart proxy-server
)

:: ============================================
:: 6. Start Cloudflare Tunnel
:: ============================================

echo [3/5] Starting Cloudflare Tunnel...

call pm2 describe cloudflared-tunnel >nul 2>&1

if errorlevel 1 (
    call pm2 start "cloudflared.exe" --name cloudflared-tunnel --interpreter none -- tunnel --url http://localhost:1881 --logfile tunnel.log
) else (
    call pm2 restart cloudflared-tunnel
)

:: ============================================
:: 7. Start URL Watcher
:: ============================================

echo [4/5] Starting URL Watcher...

call pm2 describe url-watcher >nul 2>&1

if errorlevel 1 (
    call pm2 start "scripts\update-url.js" --name url-watcher
) else (
    call pm2 restart url-watcher
)

:: ============================================
:: 8. Save PM2 Process List
:: ============================================

echo.
echo Saving PM2 processes...
call pm2 save

:: ============================================
:: 9. Start Delta OHM in Separate CMD
:: ============================================

echo [5/5] Starting Delta OHM Reader...

start "SmartBuilding - Delta OHM" /D "%PROJECT%" cmd /k "node scripts\deltaohm.js"

:: ============================================
:: 10. Create PM2 Scheduled Task
:: ============================================

echo.
echo Configuring PM2 automatic startup...

for /f "delims=" %%P in ('where pm2.cmd') do (
    if not defined PM2_PATH set "PM2_PATH=%%P"
)

if not defined PM2_PATH (
    echo ERROR: Cannot locate pm2.cmd
    goto finish
)

set "TASK_NAME=SmartBuilding PM2 Startup"

schtasks /query /tn "%TASK_NAME%" >nul 2>&1

if not errorlevel 1 (
    echo Scheduled task already exists.
    echo Keeping the existing task.
    goto finish
)

:: Generate a small helper for Task Scheduler.
set "RESTORE_SCRIPT=%PROJECT%Restore-PM2.bat"

> "%RESTORE_SCRIPT%" echo @echo off
>> "%RESTORE_SCRIPT%" echo cd /d "%PROJECT%"
>> "%RESTORE_SCRIPT%" echo call "%PM2_PATH%" resurrect

schtasks /create /f ^
 /tn "%TASK_NAME%" ^
 /tr "cmd.exe /c \"\"%RESTORE_SCRIPT%\"\"" ^
 /sc onlogon ^
 /ru "%USERDOMAIN%\%USERNAME%" ^
 /it ^
 /rl HIGHEST

if errorlevel 1 (
    echo WARNING: Scheduled task creation failed.
) else (
    echo Scheduled task created successfully.
)

goto finish

:missing
echo ERROR: Required JavaScript file is missing.
pause
exit /b 1

:finish
echo.
echo ============================================
echo          STARTUP COMPLETED
echo ============================================
echo.
echo PM2 processes:
call pm2 list

echo.
echo Node-RED: http://localhost:1880
echo Proxy:    http://localhost:1881
echo.
echo Check the Delta OHM Chromium window.
echo.
pause
endlocal

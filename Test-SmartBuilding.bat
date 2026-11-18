
@echo off
setlocal
title Smart Building System - Safe Test

set "PROJECT=%~dp0"
cd /d "%PROJECT%"

echo ============================================
echo     SMART BUILDING SYSTEM - SAFE TEST
echo ============================================
echo.
echo This test will NOT start, stop, restart,
echo save or modify any running services.
echo.

:: ============================================
:: 1. Check Project Files
:: ============================================

echo [1/5] Checking project files...

if exist "scripts\proxy-server.js" (
    echo [OK] Proxy server found
) else (
    echo [MISSING] Proxy server
)

if exist "scripts\update-url.js" (
    echo [OK] URL watcher found
) else (
    echo [MISSING] URL watcher
)

if exist "scripts\deltaohm.js" (
    echo [OK] Delta OHM reader found
) else (
    echo [MISSING] Delta OHM reader
)

if exist "cloudflared.exe" (
    echo [OK] Cloudflare executable found
) else (
    echo [MISSING] Cloudflare executable
)

if exist ".env" (
    echo [OK] Environment file found
) else (
    echo [MISSING] Environment file
)

:: ============================================
:: 2. Check Installed Commands
:: ============================================

echo.
echo [2/5] Checking installed commands...

where node
where pm2
where node-red

:: ============================================
:: 3. Check Existing PM2 Processes
:: ============================================

echo.
echo [3/5] Checking PM2 processes...

call pm2 list

:: ============================================
:: 4. Check Local Server Ports
:: ============================================

echo.
echo [4/5] Checking local ports...

powershell -NoProfile -Command "Test-NetConnection localhost -Port 1880 -InformationLevel Quiet"

powershell -NoProfile -Command "Test-NetConnection localhost -Port 1881 -InformationLevel Quiet"

:: ============================================
:: 5. Check Scheduled Task
:: ============================================

echo.
echo [5/5] Checking PM2 Scheduled Tasks...

schtasks /query /tn "SmartBuilding PM2 Startup" 2>nul

schtasks /query /tn "PM2 Startup" 2>nul

echo.
echo ============================================
echo           SAFE TEST COMPLETED
echo ============================================
echo.
echo No services were modified.
echo No scheduled tasks were created.
echo No PM2 process list was saved.
echo.
pause
endlocal

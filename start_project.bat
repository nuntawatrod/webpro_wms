@echo off
title Fresh WMS - Startup
echo ===================================================
echo     Starting Fresh WMS Project...
echo ===================================================

cd /d "%~dp0"

echo [1/2] Checking and installing dependencies...
call npm init -y
call npm install express ejs sqlite3 cors csv-parser express-session bcryptjs tailwindcss@3

:: Clear any existing process using the desired port before starting
set PORT=%PORT:3000%
if "%PORT%"=="" set PORT=3000

echo [2/3] Releasing port %PORT% if occupied...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do (
    echo Killing process %%a using port %PORT%
    taskkill /PID %%a /F >nul 2>&1
)

echo [2/2] Starting the server...
echo.

node server.js

pause
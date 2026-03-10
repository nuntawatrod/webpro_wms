@echo off
title Fresh WMS - Startup
echo ===================================================
echo     Starting Fresh WMS Project...
echo ===================================================

cd /d "%~dp0"

echo [1/2] Checking and installing dependencies...
call npm init -y
call npm install express ejs sqlite3 cors csv-parser express-session bcryptjs tailwindcss@3

echo [2/2] Starting the server...
echo.

node server.js

pause
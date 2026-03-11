@echo off
cd /d "%~dp0"
echo Building frontend...
call npm run build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)
echo.
echo Starting application...
set NODE_ENV=development
call npm start

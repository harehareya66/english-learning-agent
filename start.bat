@echo off
cd /d "%~dp0"
echo ============================================
echo   English Learning Agent - Starting...
echo   Backend + Frontend served at:
echo   http://localhost:3000
echo ============================================
echo.
echo Press Ctrl+C to stop the server.
echo.
npm run server
pause

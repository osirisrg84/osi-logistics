@echo off
echo.
echo ========================================
echo   OSI Logistics - Dispatch Platform
echo ========================================
echo.
echo Starting Backend (Port 3001)...
start "OSI Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 4 /nobreak > nul

echo Starting Frontend (Port 5173)...
start "OSI Frontend" cmd /k "cd /d "%~dp0frontend" && npx vite --port 5173"
timeout /t 5 /nobreak > nul

echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo  OSI Logistics is now running!
echo  Open: http://localhost:5173
echo ========================================
echo.
pause

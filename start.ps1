# OSI Logistics - Start Script
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    OSI Logistics - Dispatch Platform   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start Backend
Write-Host "[1/2] Starting Backend (Port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/2] Starting Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npx vite --port 5173" -WindowStyle Normal

Start-Sleep -Seconds 4

# Open browser
Write-Host ""
Write-Host "Opening OSI Logistics in your browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "App running at: http://localhost:5173" -ForegroundColor Green
Write-Host "API running at: http://localhost:3001/api" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

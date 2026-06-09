@echo off
echo ==========================================
echo   OSI Logistics - Deploy to Production
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] Committing any pending changes...
git add -A
git diff --cached --quiet || git commit -m "Deploy update"

echo.
echo [2/3] Pushing to GitHub...
git push origin master

echo.
echo [3/3] Deploying to Vercel (production)...
cd frontend
set NODE_TLS_REJECT_UNAUTHORIZED=0
vercel --prod --yes

echo.
echo ==========================================
echo   Done! Live at: https://osi-logistics.vercel.app
echo ==========================================
pause

@echo off
cd /d "%~dp0"

git init
git add .
git commit -m "Initial commit - Life Class app"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/songchankeun-ship-it/life-class.git
git push -u origin main

echo.
echo ===========================================
echo  Done. Repo URL:
echo  https://github.com/songchankeun-ship-it/life-class
echo ===========================================
pause

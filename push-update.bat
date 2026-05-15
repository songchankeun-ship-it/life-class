@echo off
cd /d "%~dp0"
echo Adding changes...
git add .
echo Committing...
git commit -m "Add Telegram notifications + improved icons"
echo Pushing...
git push
echo.
echo Done. Check Actions at https://github.com/songchankeun-ship-it/life-class/actions
pause

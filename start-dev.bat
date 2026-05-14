@echo off
title 오늘의 교시 - Life Class (dev)
cd /d "%~dp0"
echo.
echo ============================================
echo  Life Class 개발 서버를 시작합니다
echo  폴더: %CD%
echo ============================================
echo.

REM node 확인
where node >nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo https://nodejs.org/ko 에서 LTS 버전을 설치한 뒤 다시 실행해주세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/2] 의존성 설치 (npm install) ...
  call npm install
  if errorlevel 1 (
    echo [오류] npm install 실패. 위 메시지를 확인해주세요.
    pause
    exit /b 1
  )
) else (
  echo [1/2] node_modules 가 이미 있어 설치 단계를 건너뜁니다.
)

echo.
echo [2/2] Vite dev 서버 시작 (http://localhost:5173)
echo  - 잠시 후 브라우저가 자동으로 열립니다.
echo  - 종료하려면 Ctrl+C 를 누른 뒤 Y 를 입력하세요.
echo.
call npm run dev

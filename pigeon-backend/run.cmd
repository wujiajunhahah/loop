@echo off
setlocal
set "BACKEND_ROOT=%~dp0"
set "PYTHON_PATH=%BACKEND_ROOT%.venv\Scripts\python.exe"

if not exist "%PYTHON_PATH%" (
  echo Backend virtual environment was not found. Follow README.md to install dependencies first.
  exit /b 1
)

cd /d "%BACKEND_ROOT%"

powershell.exe -NoProfile -Command "try { $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8010/health' -TimeoutSec 2; if ($response.status -eq 'ok') { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo Backend is already running on port 8010.
  echo API docs: http://127.0.0.1:8010/docs
  echo No second server needs to be started.
  exit /b 0
)

"%PYTHON_PATH%" -m uvicorn app.main:app --host 0.0.0.0 --port 8010

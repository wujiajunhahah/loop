@echo off
setlocal
set "FRONTEND_ROOT=%~dp0"
set "NODE_DIR=C:\Users\Chris\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PNPM_PATH=C:\Users\Chris\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"

if not exist "%NODE_DIR%\node.exe" (
  echo Bundled Node.js was not found.
  exit /b 1
)
if not exist "%PNPM_PATH%" (
  echo Bundled pnpm was not found.
  exit /b 1
)

powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5174/' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
  echo Integrated frontend is already running on port 5174.
  echo Open: http://127.0.0.1:5174/
  exit /b 0
)

set "PATH=%NODE_DIR%;%PATH%"
cd /d "%FRONTEND_ROOT%"
call "%PNPM_PATH%" exec vite --host 0.0.0.0 --port 5174

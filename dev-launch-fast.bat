@echo off
setlocal

title game-translator (launcher)
cd /d "%~dp0"
set "FRONTEND_WAIT_LIMIT=90"
set "WAITED=0"

where npm >nul 2>&1
if errorlevel 1 (
  echo [launcher] npm not found in PATH. Install Node.js first.
  pause
  exit /b 1
)

call :check_frontend
if not errorlevel 1 (
  echo [launcher] Frontend already ready on port 3100, skipping dev start.
  goto :launch_electron
)

call :frontend_pid
if defined FRONTEND_PID goto :stuck_existing_frontend

echo [launcher] Starting Next.js dev in separate window...
start "game-translator (next dev)" cmd /k "cd /d %~dp0 && npm run dev"

echo [launcher] Waiting for frontend to be ready on port 3100...
:wait_loop
timeout /t 1 /nobreak >nul
set /a WAITED+=1
call :check_frontend
if %WAITED% geq %FRONTEND_WAIT_LIMIT% goto :frontend_wait_timeout
if errorlevel 1 goto :wait_loop
echo [launcher] Frontend ready.

:launch_electron
echo [launcher] Starting Electron...
set "GT_EXTERNAL_FRONTEND=1"
call npx electron .

echo.
echo [launcher] Electron exited. Next.js dev window remains open.
echo [launcher] Press any key to close this launcher window...
pause >nul
exit /b 0

:check_frontend
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://127.0.0.1:3100/'; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } } catch {}; exit 1" >nul 2>&1
exit /b %errorlevel%

:frontend_pid
set "FRONTEND_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:"127\.0\.0\.1:3100 .*LISTENING"') do (
  set "FRONTEND_PID=%%P"
  goto :frontend_pid_done
)
:frontend_pid_done
exit /b 0

:stuck_existing_frontend
echo [launcher] Port 3100 is already owned by PID %FRONTEND_PID%, but the frontend health check is not responding.
echo [launcher] Not starting another Next.js process and not launching Electron into a black window.
echo [launcher] Close that stuck process/window, or approve killing PID %FRONTEND_PID%.
pause
exit /b 1

:frontend_wait_timeout
call :frontend_pid
echo [launcher] Frontend did not become ready within %FRONTEND_WAIT_LIMIT% seconds.
if defined FRONTEND_PID echo [launcher] Port 3100 is currently owned by PID %FRONTEND_PID%.
echo [launcher] Not launching Electron into a black window.
pause
exit /b 1

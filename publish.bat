@echo off
REM ============================================================
REM  One-click publish: commit local changes, sync with remote,
REM  push to GitHub. Pushing triggers the Pages deploy workflow.
REM  Uses the portable Git bundled under tools\mingit, so no
REM  Git installation or admin rights are required.
REM ============================================================
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "GIT=%ROOT%tools\mingit\cmd\git.exe"
set "PATH=%ROOT%tools\mingit\mingw64\bin;%PATH%"

if not exist "%GIT%" (
  echo [ERROR] Portable Git not found at tools\mingit
  echo Re-copy the tools\mingit folder, then run this script again.
  goto :end
)

echo [1/5] Staging and committing local changes...
"%GIT%" add -A
"%GIT%" diff --cached --quiet
if errorlevel 1 (
  "%GIT%" commit -m "chore: publish site update"
) else (
  echo No local changes to commit.
)

echo [2/5] Enabling GitHub login via Credential Manager...
"%GIT%" config credential.helper manager

echo [3/5] Fetching latest from origin (a GitHub login window may appear)...
"%GIT%" fetch origin
if errorlevel 1 (
  echo [ERROR] Fetch failed. Check your network / GitHub login, then retry.
  goto :end
)

echo [4/5] Merging remote history (local version wins on conflicts)...
"%GIT%" rev-parse --verify origin/main >nul 2>nul
if not errorlevel 1 (
  "%GIT%" merge origin/main --allow-unrelated-histories -X ours --no-edit
  if errorlevel 1 (
    echo [ERROR] Automatic merge failed. Resolve conflicts, then run:
    echo   git push -u origin main
    goto :end
  )
) else (
  echo Remote main not found yet; pushing as the first commit.
)

echo [5/5] Pushing to origin/main...
"%GIT%" push -u origin main
if errorlevel 1 (
  echo [ERROR] Push failed. Review the message above and retry.
  goto :end
)

echo.
echo ============================================================
echo  Pushed. Watch the deploy run:
echo  https://github.com/woshibaojie1023/ev-go-global/actions
echo  Live site:
echo  https://woshibaojie1023.github.io/ev-go-global/
echo ============================================================

:end
echo.
pause

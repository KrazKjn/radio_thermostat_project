@echo off

IF NOT "%SHELLY_IP%" == "" GOTO :RunCommand
@Echo Use the following to set SHELLY_IP.
@Echo SET SHELLY_IP=xx.xx.xx.xx
GoTo :End

:RunCommand
setlocal enabledelayedexpansion

:retry
echo Sending Sys status request...
curl -X POST -d "{\"id\":1, \"method\":\"Sys.GetStatus\"}" http://%SHELLY_IP%/rpc
if %ERRORLEVEL% neq 0 (
    echo Request failed with ERRORLEVEL %ERRORLEVEL%. Retrying in 2 seconds...
    timeout /t 2 >nul
    goto retry
)

echo Request succeeded. Sys status retrieved.
endlocal

:End
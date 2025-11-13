@echo off

IF NOT "%SHELLY_IP%" == "" GOTO :RunCommand
@Echo Use the following to set SHELLY_IP.
@Echo SET SHELLY_IP=xx.xx.xx.xx
GoTo :End

:RunCommand
setlocal enabledelayedexpansion

:retry
echo Sending MQTT config request...
curl -X POST -H "Content-Type: application/json" -d @ShellyHTGen3_mqtt_config.json http://%SHELLY_IP%/rpc
if %ERRORLEVEL% neq 0 (
    echo Request failed with ERRORLEVEL %ERRORLEVEL%. Retrying in 2 seconds...
    timeout /t 2 >nul
    goto retry
)

echo Request succeeded. MQTT config updated.
endlocal

Call RebootShellyHTG3.cmd
Call GetShellMqttConfig.cmd
Call GetShellMqttStatus.cmd

:End
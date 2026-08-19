@echo off
set "HTML_PATH=%~dp0index.html"

:: Tentar abrir no Edge (Modo App Nativo)
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>&1
if %errorlevel% equ 0 (
    start "" msedge.exe --app="file:///%HTML_PATH%" --window-size=1366,768
    exit
)

:: Tentar abrir no Chrome (Modo App Nativo)
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if %errorlevel% equ 0 (
    start "" chrome.exe --app="file:///%HTML_PATH%" --window-size=1366,768
    exit
)

:: Fallback caso os executáveis não estejam registrados no App Paths
start "" "%HTML_PATH%"
exit


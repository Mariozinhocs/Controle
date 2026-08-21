@echo off
set "HTML_PATH=%~dp0index.html"

:: Tentar abrir no Edge (Modo Privado Local)
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>&1
if %errorlevel% equ 0 (
    start "" msedge.exe --inprivate "file:///%HTML_PATH%"
    exit
)

:: Tentar abrir no Chrome (Modo Anônimo Local)
reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if %errorlevel% equ 0 (
    start "" chrome.exe --incognito "file:///%HTML_PATH%"
    exit
)

:: Fallback caso os executáveis não estejam registrados no App Paths
start "" "file:///%HTML_PATH%"
exit


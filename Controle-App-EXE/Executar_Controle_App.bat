@echo off
title Controle de Requisicoes - App Nativo Isolado
echo =======================================================
echo   Inicializando Controle de Requisicoes em Modo Executavel
echo =======================================================
echo.
cd /d "%~dp0"
if not exist node_modules (
    echo Instalando dependencias do Electron na pasta isolada...
    call npm install
)
echo Abrindo aplicativo...
call npm start
exit

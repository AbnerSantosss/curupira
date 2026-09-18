@echo off
setlocal
title CURUPIRA - Terminal de Extracao de Midia
cd /d "%~dp0.."

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo.
echo   CURUPIRA - Abner Software
echo   -------------------------
echo.

REM --- Ja esta rodando? Apenas abre o navegador. ---
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',%PORT%);exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
  echo   Servidor ja esta rodando. Abrindo o navegador...
  start "" "%URL%"
  timeout /t 2 >nul
  exit /b 0
)

REM --- Node instalado? ---
where node >nul 2>&1
if errorlevel 1 (
  echo   ERRO: Node.js nao encontrado no PATH.
  echo   Instale a versao 20.9 ou superior: https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM --- Dependencias ---
if not exist "node_modules\next" (
  echo   Instalando dependencias ^(primeira execucao, pode demorar^)...
  call npm install || goto :erro
)

REM --- Build de producao ---
if not exist ".next\BUILD_ID" (
  echo   Compilando o app ^(primeira execucao^)...
  call npm run build || goto :erro
)

REM --- Abre o navegador assim que a porta responder ---
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-browser.ps1" -Port %PORT%

echo   Iniciando servidor em %URL%
echo   Feche esta janela para encerrar o CURUPIRA.
echo.
call npm start
goto :fim

:erro
echo.
echo   Falha ao preparar o app. Veja a mensagem acima.
echo.
pause
exit /b 1

:fim
endlocal

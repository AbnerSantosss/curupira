@echo off
setlocal
title CURUPIRA - Terminal de Extracao de Midia
cd /d "%~dp0.."

set "BASE_PORT=3000"

echo.
echo   CURUPIRA - Abner Software
echo   -------------------------
echo.

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

REM --- Escolhe a porta: reaproveita o CURUPIRA ja aberto, pula porta de outro programa ---
set "MODE="
for /f "tokens=1,2" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pick-port.ps1" -Port %BASE_PORT%') do (
  set "MODE=%%a"
  set "PORT=%%b"
)
if not defined MODE (
  echo   ERRO: nenhuma porta livre a partir da %BASE_PORT%.
  echo   Feche algum programa que esteja usando essas portas e tente de novo.
  echo.
  pause
  exit /b 1
)
set "URL=http://localhost:%PORT%"

if "%MODE%"=="RUNNING" (
  echo   Servidor ja esta rodando em %URL%. Abrindo o navegador...
  start "" "%URL%"
  timeout /t 2 >nul
  exit /b 0
)

if not "%PORT%"=="%BASE_PORT%" (
  echo   A porta %BASE_PORT% esta em uso por outro programa. Usando a porta %PORT%.
)

REM --- Abre o navegador assim que a porta responder ---
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-browser.ps1" -Port %PORT%

echo   Iniciando servidor em %URL%
echo   Feche esta janela para encerrar o CURUPIRA.
echo.
call npm start -- -p %PORT%
goto :fim

:erro
echo.
echo   Falha ao preparar o app. Veja a mensagem acima.
echo.
pause
exit /b 1

:fim
endlocal

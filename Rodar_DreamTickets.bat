@echo off
chcp 65001 >nul
title DreamTickets - MilesControl
cd /d "%~dp0"

echo ============================================
echo    DreamTickets / MilesControl
echo ============================================
echo.

REM --- 1. Verifica Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale o Node 18+ em https://nodejs.org
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo Node.js: %%v
echo.

REM --- 2. Instala dependencias na primeira vez ---
if not exist "node_modules" (
  echo Instalando dependencias ^(npm install^) - pode levar alguns minutos...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha no npm install. Verifique sua conexao com a internet.
    pause
    exit /b 1
  )
  echo.
)

REM --- 3. Build de producao ---
echo Gerando build de producao...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERRO] Falha no build. Leia as mensagens em vermelho acima e me envie.
  pause
  exit /b 1
)
echo.
echo Build OK. Iniciando o servidor...
echo.

REM --- 4. Sobe o preview EM SEGUNDO PLANO e so abre o navegador quando responder ---
start "DreamTickets Server" /min cmd /c "npm run preview -- --host --port 4173"

echo Aguardando o servidor subir em http://localhost:4173 ...
set /a tentativas=0
:esperar
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:4173 -TimeoutSec 2)|Out-Null;exit 0}catch{exit 1}" >nul 2>nul
if errorlevel 1 (
  set /a tentativas+=1
  if %tentativas% lss 15 goto esperar
  echo [AVISO] O servidor demorou para responder. Abrindo mesmo assim...
)

start "" http://localhost:4173
echo.
echo App rodando! Janela do servidor esta minimizada na barra de tarefas.
echo Para encerrar, feche a janela "DreamTickets Server".
echo.
pause

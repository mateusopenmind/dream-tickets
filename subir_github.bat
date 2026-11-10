@echo off
setlocal
REM ============================================================
REM  DreamTickets - Enviar codigo completo para o GitHub
REM  Repo: https://github.com/mateusopenmind/dream-tickets
REM  Uso: duplo clique. Na primeira vez o Git abre o navegador
REM  para voce autorizar (Git Credential Manager).
REM ============================================================

cd /d "%~dp0dream-tickets"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Git nao esta instalado.
  echo Baixe em: https://git-scm.com/download/win  ^(instalacao padrao, 2 min^)
  echo Depois rode este arquivo de novo.
  pause
  exit /b 1
)

echo [1/6] Removendo .git antigo/quebrado...
if exist .git rmdir /s /q .git

echo [2/6] Iniciando repositorio...
git init >nul
git branch -M main
git config core.autocrlf false
git config user.name  "Mateus (Open Mind)"  >nul
git config user.email "mateus@openmindsolutions.com.br" >nul

echo [3/6] Garantindo o public/.htaccess correto (SPA + regra do Let's Encrypt/SSL)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[IO.File]::WriteAllBytes('public\.htaccess', [Convert]::FromBase64String('IyBTUEEgZmFsbGJhY2sgLSBvYnJpZ2F0b3JpbyBwYXJhIHJvdGFzIGNvbW8gL3BpeC8qIGZ1bmNpb25hcmVtIGVtIGFjZXNzbyBkaXJldG8KUmV3cml0ZUVuZ2luZSBPbgpSZXdyaXRlQmFzZSAvCgojIE5hbyByZWVzY3JldmVyIG8gZGVzYWZpbyBkbyBMZXQncyBFbmNyeXB0IChlbWlzc2FvL3Jlbm92YWNhbyBkbyBTU0wpClJld3JpdGVSdWxlIF5cLndlbGwta25vd24vIC0gW0xdCgpSZXdyaXRlUnVsZSBeaW5kZXhcLmh0bWwkIC0gW0xdClJld3JpdGVDb25kICV7UkVRVUVTVF9GSUxFTkFNRX0gIS1mClJld3JpdGVDb25kICV7UkVRVUVTVF9GSUxFTkFNRX0gIS1kClJld3JpdGVSdWxlIC4gL2luZGV4Lmh0bWwgW0xdCgojIENhY2hlOiBhc3NldHMgY29tIGhhc2ggcG9yIDEgYW5vOyBpbmRleC5odG1sIHNlbXByZSByZXZhbGlkYQo8SWZNb2R1bGUgbW9kX2hlYWRlcnMuYz4KICA8RmlsZXNNYXRjaCAiXC4oanN8Y3NzfHdvZmYyP3xwbmd8anBnfGpwZWd8c3ZnfHdlYnApJCI+CiAgICBIZWFkZXIgc2V0IENhY2hlLUNvbnRyb2wgInB1YmxpYywgbWF4LWFnZT0zMTUzNjAwMCwgaW1tdXRhYmxlIgogIDwvRmlsZXNNYXRjaD4KICA8RmlsZXNNYXRjaCAiaW5kZXhcLmh0bWwkIj4KICAgIEhlYWRlciBzZXQgQ2FjaGUtQ29udHJvbCAibm8tY2FjaGUiCiAgPC9GaWxlc01hdGNoPgo8L0lmTW9kdWxlPgo='))"
if errorlevel 1 (
  echo [AVISO] Nao consegui regenerar o .htaccess automaticamente. Verifique a regra do Let's Encrypt manualmente.
)

echo [4/6] Adicionando arquivos (respeitando .gitignore)...
git add -A

echo [5/6] Criando commit...
git commit -m "sync: codigo completo local (pipeline de deploy Locaweb incluido)" >nul

echo [6/6] Enviando para o GitHub (pode abrir o navegador para login)...
git remote add origin https://github.com/mateusopenmind/dream-tickets.git
git push -u origin main --force
if errorlevel 1 (
  echo.
  echo [ERRO] O push falhou. Tire um print desta janela e mande para o Claude.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo [OK] Codigo enviado! Acompanhe a publicacao em:
echo https://github.com/mateusopenmind/dream-tickets/actions
echo ============================================================
echo Obs: a publicacao so funciona depois de cadastrar os
echo Secrets no GitHub (o Claude te passou o passo a passo).
echo.
pause

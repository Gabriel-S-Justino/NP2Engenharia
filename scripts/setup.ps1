# Instala as dependências no Windows PowerShell. Uso: .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

Write-Host "==> Backend: ambiente virtual em backend\.venv"
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install --upgrade pip
backend\.venv\Scripts\pip.exe install -r backend\requirements-dev.txt

Write-Host "==> Frontend: dependências em apps\mobile"
Push-Location apps\mobile
npm ci
Pop-Location

if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Write-Host "==> .env criado a partir de .env.example (revise os valores)."
}
Write-Host "Pronto. Inicie com .\scripts\dev.ps1"

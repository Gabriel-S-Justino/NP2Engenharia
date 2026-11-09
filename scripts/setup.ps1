# Instala as dependências no Windows PowerShell. Uso: .\scripts\setup.ps1
param([string]$PythonExecutable)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\windows-common.ps1"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

Write-Host "==> Backend: ambiente virtual em backend\.venv"
$python = Get-ProjectPython $PythonExecutable
if (-not (Test-Path backend\.venv\Scripts\python.exe)) {
  Invoke-ProjectPython $python @('-m', 'venv', 'backend\.venv')
}
$python = (Resolve-Path backend\.venv\Scripts\python.exe).Path
Invoke-ProjectPython $python @('-m', 'pip', 'install', '--cache-dir', "$Root\data\pip-cache", '-r', 'backend\requirements-dev.txt')

Write-Host "==> Frontend: dependências em apps\mobile"
Push-Location apps\mobile
try { Invoke-ProjectNpm ci --cache "$Root\data\npm-cache" }
finally { Pop-Location }

Invoke-ProjectPython $python @('scripts/configure_local.py')
Write-Host "Adicione seus documentos manualmente em Documentos/ e configure LLM_API_KEY no .env."
Write-Host "Pronto. Inicie com .\scripts\dev.ps1"

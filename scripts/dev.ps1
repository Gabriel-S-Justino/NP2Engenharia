# Inicia backend e frontend web no Windows. Uso: .\scripts\dev.ps1  ou  .\scripts\dev.ps1 -Demo
param([switch]$Demo)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

if ($Demo) {
  $env:EMBEDDING_PROVIDER = "hashing"; $env:LLM_PROVIDER = "demo"
  $env:DOCUMENTS_DIR = "tests/fixtures/documentos_sinteticos"; $env:DATA_DIR = "data/demo"
  Write-Host "MODO DEMONSTRACAO: embeddings lexicais, gerador extrativo (sem LLM) e documentos sinteticos."
}
if (-not $env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:8000" }

$backend = Start-Process -PassThru -NoNewWindow -WorkingDirectory "$Root\backend" `
  -FilePath "$Root\backend\.venv\Scripts\uvicorn.exe" -ArgumentList "app.main:app --host 127.0.0.1 --port 8000 --reload"
try {
  Push-Location apps\mobile
  npx expo start --web
} finally {
  Pop-Location
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
}

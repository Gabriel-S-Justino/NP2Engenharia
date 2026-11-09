# Inicia backend e frontend web no Windows. Uso: .\scripts\dev.ps1
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\windows-common.ps1"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

if (-not $env:EXPO_PUBLIC_API_URL) { $env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:8000" }

$backend = Start-Process -PassThru -WindowStyle Hidden -WorkingDirectory "$Root\backend" `
  -FilePath "$Root\backend\.venv\Scripts\uvicorn.exe" -ArgumentList "app.main:app --host 127.0.0.1 --port 8000 --reload"
try {
  Push-Location apps\mobile
  Invoke-ProjectNpm run web
} finally {
  Pop-Location
  Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
}

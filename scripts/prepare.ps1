param([switch]$SkipChecks)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-common.ps1"
Push-Location $ProjectRoot
try {
    $python = Get-ProjectPython
    if (-not (Test-Path backend\.venv\Scripts\python.exe)) { throw 'Execute .\scripts\setup.ps1 primeiro.' }
    $python = (Resolve-Path backend\.venv\Scripts\python.exe).Path
    $env:PYTHONUTF8 = '1'
    Invoke-ProjectPython $python @('scripts/prepare_real.py')
    if (-not $SkipChecks) { Invoke-ProjectPython $python @('scripts/verify_project.py') }
} finally { Pop-Location }

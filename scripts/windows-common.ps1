# Funções compartilhadas. Nenhum caminho pessoal é gravado nos arquivos versionados.
$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path

function Get-ProjectPython {
    param([string]$Preferred)
    if ($Preferred) { return $Preferred }
    $venv = Join-Path $ProjectRoot 'backend\.venv\Scripts\python.exe'
    if (Test-Path -LiteralPath $venv) { return $venv }
    # O runtime do Codex é uma alternativa ao Python instalado pelo usuário.
    $bundled = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
    if (Test-Path -LiteralPath $bundled) { return $bundled }
    foreach ($command in @('python', 'py')) {
        if (Get-Command $command -ErrorAction SilentlyContinue) {
            & $command -c 'import sys; assert sys.version_info >= (3, 11)' 2>$null
            if ($LASTEXITCODE -eq 0) { return $command }
        }
    }
    throw 'Python 3.11+ não encontrado. Instale Python e execute novamente, ou informe -PythonExecutable.'
}

function Invoke-ProjectNpm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArguments)
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npm) { & $npm.Source @NpmArguments }
    else {
        $localCli = Join-Path $ProjectRoot 'data\tooling\npm\package\bin\npm-cli.js'
        if (-not (Test-Path -LiteralPath $localCli)) {
            throw 'npm não encontrado. Instale Node.js 22 LTS (inclui npm) e reabra o terminal.'
        }
        & node $localCli @NpmArguments
    }
    if ($LASTEXITCODE -ne 0) { throw "npm falhou (código $LASTEXITCODE)." }
}

function Invoke-ProjectPython {
    param([string]$Executable, [string[]]$PythonArguments)
    & $Executable @PythonArguments
    if ($LASTEXITCODE -ne 0) { throw "Python falhou (código $LASTEXITCODE)." }
}

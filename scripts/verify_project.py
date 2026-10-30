"""Verificação final do projeto: estrutura, testes, lint, avaliação e build.

Uso (na raiz): python scripts/verify_project.py [--skip-frontend] [--skip-build]
Gera docs/resultados/verificacao_projeto.md com o resultado REAL de cada verificação.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = ROOT / "backend" / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
REQUIRED = [
    "README.md", "LICENSE", ".env.example", ".gitignore", "Dockerfile", "docker-compose.yml", "render.yaml",
    "Documentos/README.md", "Documentos/manifest.json",
    "backend/app/main.py", "backend/requirements.txt", "backend/pyproject.toml", "backend/.env.example",
    "apps/mobile/package.json", "apps/mobile/app.json", "vercel.json", "api/index.py", "requirements.txt",
    ".python-version", "scripts/vercel_local.py",
    "tests/acceptance/matriz_fixtures.json", "tests/acceptance/matriz_acervo_real.json",
    "docs/RELATORIO.md", "docs/ARQUITETURA.md", "docs/FONTES.md", "docs/MATRIZ_TESTES.md",
    "docs/DIARIO_VALIDACAO_IA.md", "docs/DIVISAO_TAREFAS.md", "docs/ROTEIRO_APRESENTACAO.md", "docs/LIMITACOES.md",
    "docs/UI_UX.md", "docs/DESIGN_SYSTEM.md", "docs/FLUXOS_UX.md", "docs/CONTRATO_FRONTEND.md",
    "docs/DEPLOY_VERCEL.md", "docs/DEPLOY_BACKEND.md", "docs/PRODUCAO.md", "docs/VARIAVEIS_AMBIENTE.md",
    "docs/TESTES_PRODUCAO.md", "docs/ROLLBACK.md", "docs/CONFORMIDADE.md",
    "scripts/ingest_documents.py", "scripts/run_evaluation.py", "scripts/setup.sh", "scripts/setup.ps1",
    "scripts/dev.sh", "scripts/dev.ps1", ".github/workflows/ci.yml",
]


def run(name: str, cmd: list[str], cwd: Path, env: dict | None = None) -> tuple[str, bool, str]:
    start = time.time()
    proc = subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, capture_output=True, text=True)
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-3:]
    print(f"[{'OK ' if proc.returncode == 0 else 'FALHA'}] {name} ({time.time() - start:.0f}s)")
    return name, proc.returncode == 0, " / ".join(tail)[:400]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-frontend", action="store_true")
    parser.add_argument("--skip-build", action="store_true")
    args = parser.parse_args()
    results = []
    missing = [p for p in REQUIRED if not (ROOT / p).exists()]
    results.append(("Arquivos obrigatórios presentes", not missing, f"faltando: {missing}" if missing else f"{len(REQUIRED)} arquivos"))
    results.append(("Pasta Documentos/ existe", (ROOT / "Documentos").is_dir(), ""))
    secrets_found = [p for p in ROOT.glob(".env") if p.exists()]
    results.append(("Nenhum .env versionado", not subprocess.run(["git", "ls-files", ".env"], cwd=ROOT, capture_output=True, text=True).stdout.strip(),
                    f".env local presente: {bool(secrets_found)} (ignorado pelo git)"))
    results.append(run("Backend: ruff", [str(PY), "-m", "ruff", "check", "app", "tests", "../scripts", "../api"], ROOT / "backend"))
    pg = " + Postgres/pgvector" if os.environ.get("TEST_DATABASE_URL") else " (Postgres ignorado: defina TEST_DATABASE_URL)"
    results.append(run(f"Backend: pytest{pg}", [str(PY), "-m", "pytest", "-q"], ROOT / "backend"))
    results.append(run("Função Vercel: api/index.py importa em modo serverless",
                       [str(PY), "-c", "import runpy; runpy.run_path('api/index.py')"], ROOT,
                       {"VERCEL": "1", "EMBEDDING_PROVIDER": "hashing", "ALLOW_EPHEMERAL_STORAGE": "true"}))
    with tempfile.TemporaryDirectory() as tmp:
        results.append(run("Matriz de avaliação (fixtures, hashing, demo)", [str(PY), "scripts/run_evaluation.py"], ROOT,
                           {"EMBEDDING_PROVIDER": "hashing", "LLM_PROVIDER": "demo", "DATA_DIR": tmp}))
    if not args.skip_frontend:
        mobile = ROOT / "apps" / "mobile"
        npm = "npm.cmd" if os.name == "nt" else "npm"
        results.append(run("Frontend: typecheck", [npm, "run", "typecheck"], mobile))
        results.append(run("Frontend: lint", [npm, "run", "lint"], mobile, {"EXPO_OFFLINE": "1"}))
        results.append(run("Frontend: testes", [npm, "run", "test:ci"], mobile))
        if not args.skip_build:
            results.append(run("Frontend: build web (mesma origem)", [npm, "run", "build:web"], mobile,
                               {"EXPO_OFFLINE": "1", "EXPO_PUBLIC_API_URL": ""}))

    ok = all(r[1] for r in results)
    lines = [f"# Verificação do projeto — {datetime.now(UTC).isoformat(timespec='seconds')}", "",
             "| Verificação | Resultado | Detalhe |", "|---|---|---|"]
    lines += [f"| {n} | {'aprovado' if passed else 'FALHOU'} | {detail.replace('|', '/')} |" for n, passed, detail in results]
    out = ROOT / "docs" / "resultados" / "verificacao_projeto.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nResumo salvo em {out.relative_to(ROOT)} — {'TUDO APROVADO' if ok else 'HÁ FALHAS'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

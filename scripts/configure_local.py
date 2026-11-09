"""Cria .env local com tokens aleatórios, sem imprimir valores nem sobrescrever configurações."""

from __future__ import annotations

import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    target = ROOT / ".env"
    if target.exists():
        print(".env existente preservado.")
        return 0
    content = (ROOT / ".env.example").read_text(encoding="utf-8")
    for key in ("ADMIN_TOKEN", "CRON_SECRET"):
        content = "\n".join(
            f"{key}={secrets.token_urlsafe(32)}" if line.startswith(f"{key}=") else line
            for line in content.splitlines()
        ) + "\n"
    with target.open("x", encoding="utf-8") as stream:
        stream.write(content)
    print(".env local criado com tokens aleatórios. Consulte ADMIN_TOKEN no arquivo para configurar a interface.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

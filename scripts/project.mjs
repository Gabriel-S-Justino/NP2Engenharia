// Comandos npm portáveis: PowerShell no Windows, bash em Unix.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const py = join(root, 'backend', '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
const action = process.argv[2];
let command;
let args;
if (['setup', 'dev'].includes(action)) {
  const script = action === 'setup' ? 'setup' : 'dev';
  command = windows ? 'powershell.exe' : 'bash';
  args = windows
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', `${script}.ps1`)]
    : [join(root, 'scripts', `${script}.sh`)];
} else {
  const actions = {
    'backend:test': ['-m', 'pytest', '-c', 'backend/pyproject.toml', 'backend/tests'],
    evaluate: ['scripts/run_evaluation.py', '--suite', 'acervo_real'],
    'evaluate:real': ['scripts/run_evaluation.py', '--suite', 'acervo_real', '--copy-to', 'docs/resultados'],
    prepare: ['scripts/prepare_real.py'],
    verify: ['scripts/verify_project.py'],
  };
  command = py;
  args = actions[action];
  if (!args) throw new Error(`Comando desconhecido: ${action}`);
}
const env = action === 'backend:test'
  ? { ...process.env, APP_ENV: 'test', LLM_PROVIDER: 'demo' }
  : process.env;
const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
if (result.error) console.error(`Não foi possível iniciar ${action}: ${result.error.message}. Execute npm run setup primeiro.`);
process.exitCode = result.status ?? 1;

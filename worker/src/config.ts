import os from 'node:os'
import path from 'node:path'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta ${name} en worker/.env (ver .env.example)`)
  return value
}

function num(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const home = os.homedir()
const claudeRoot = process.env.CLAUDE_ROOT?.trim() || path.join(home, 'Claude')
const toolsDir = process.env.TOOLS_DIR?.trim() || path.join(claudeRoot, 'lista-2/_tools')

export const config = {
  prospectorUrl: required('PROSPECTOR_URL').replace(/\/$/, ''),
  workerToken: required('WORKER_TOKEN'),
  workerId: process.env.WORKER_ID?.trim() || os.hostname().split('.')[0],
  concurrency: num('CONCURRENCY', 4),
  auth: process.env.WORKER_AUTH === 'api-key' ? ('api-key' as const) : ('plan' as const),
  claudeRoot,
  demosDir: process.env.DEMOS_DIR?.trim() || path.join(claudeRoot, 'prospector-demos'),
  toolsDir,
  python: path.join(toolsDir, 'venv/bin/python'),
  portafolioDir: process.env.PORTAFOLIO_DIR?.trim() || path.join(claudeRoot, 'portafolio'),
  demosBaseUrl: (process.env.DEMOS_BASE_URL?.trim() || 'https://demos.diabolicalservices.tech').replace(/\/$/, ''),
  publish: process.env.PUBLISH !== 'false',
  sandbox: process.env.WORKER_SANDBOX === 'true',
  /** Puertos para los servidores de Astro de cada demo en paralelo. */
  basePort: num('BASE_PORT', 4600),
  pollMs: num('POLL_MS', 15_000),
  version: '0.1.0',
}

export type Config = typeof config

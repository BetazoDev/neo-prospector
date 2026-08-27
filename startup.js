#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// startup.js - verify the production database, apply migrations, then launch Next.js
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env'), override: false, quiet: true })

const ROOT = __dirname
const STANDALONE_SERVER_PATH = path.join(ROOT, '.next', 'standalone', 'server.js')
const NEXT_CLI = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
const DATABASE_CHECK = path.join(ROOT, 'scripts', 'check-database.js')
const BOOTSTRAP_ADMIN = path.join(ROOT, 'scripts', 'bootstrap-admin.ts')
const PORT     = process.env.PORT || '3000'
const HOSTNAME = process.env.BIND_HOST || process.env.HOST || '0.0.0.0'
const env      = { ...process.env, PORT, HOSTNAME }

const useStandalone = fs.existsSync(STANDALONE_SERVER_PATH)

if (!useStandalone && !fs.existsSync(NEXT_CLI)) {
  console.error('[startup] Next.js CLI not found. Did dependencies install successfully?')
  process.exit(1)
}

if (!fs.existsSync(PRISMA_CLI)) {
  console.error('[startup] Prisma CLI not found. Did dependencies install successfully?')
  process.exit(1)
}

function runRequiredStep(label, args) {
  console.log(`[startup] ${label}...`)
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: ROOT, env })
  if (result.error || result.status !== 0) {
    console.error(`[startup] ${label} failed; refusing to start.`, result.error || `exit ${result.status}`)
    process.exit(1)
  }
}

// `migrate deploy` is idempotent and never resets data. Any failure is fatal.
runRequiredStep('Validating PostgreSQL target', [DATABASE_CHECK])
runRequiredStep('Applying Prisma migrations', [PRISMA_CLI, 'migrate', 'deploy'])
runRequiredStep('Verifying migrated PostgreSQL schema', [DATABASE_CHECK, '--require-schema'])

// This is idempotent: it only creates the administrator when the record is
// missing, and never changes an existing password or application data.
// Dokploy runtime variables take precedence; the legacy recovery values keep
// a fresh persistent database usable even if Dokploy misses its env file.
runRequiredStep('Ensuring administrator exists', [
  path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  BOOTSTRAP_ADMIN,
])

const serverArgs = useStandalone
  ? [STANDALONE_SERVER_PATH]
  : [NEXT_CLI, 'start', '-H', HOSTNAME, '-p', PORT]

console.log(
  `[startup] Starting Next.js on ${HOSTNAME}:${PORT} (${useStandalone ? 'standalone' : 'next start'})...`
)

const server = spawn(process.execPath, serverArgs, {
  stdio: 'inherit',
  cwd: ROOT,
  env,
})

server.on('exit', (code) => {
  console.log(`[startup] server exited with code ${code}`)
  process.exit(code ?? 1)
})

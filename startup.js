#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// startup.js - apply Prisma migrations + seed admin user before launching Next.js
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const STANDALONE_SERVER_PATH = path.join(ROOT, '.next', 'standalone', 'server.js')
const NEXT_CLI = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
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

// STEP 1: Apply migrations (idempotent — never drops data)
console.log('[startup] Applying Prisma migrations...')
const migrateSync = spawnSync(
  process.execPath,
  [PRISMA_CLI, 'migrate', 'deploy'],
  { stdio: 'inherit', cwd: ROOT, env }
)
if (migrateSync.error || migrateSync.status !== 0) {
  console.error('[startup] Migration warning:', migrateSync.error || migrateSync.status)
  // Non-fatal: DB may already be up-to-date
}

// STEP 2: Ensure admin user exists on EVERY startup/restart.
// This prevents the FK constraint error on CSV import when the JWT cookie
// still holds an old userId but the users table was empty after VPS restart.
console.log('[startup] Ensuring admin user exists in database...')
const seedSync = spawnSync(
  'npm',
  ['run', 'db:seed'],
  { stdio: 'inherit', cwd: ROOT, env, shell: true }
)
if (seedSync.error) {
  console.error('[startup] Seed warning (non-fatal):', seedSync.error.message)
}

// STEP 3: Start Next.js server
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

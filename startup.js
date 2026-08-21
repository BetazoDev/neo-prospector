#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// startup.js - apply Prisma migrations safely before launching Next.js
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const STANDALONE_SERVER_PATH = path.join(ROOT, '.next', 'standalone', 'server.js')
const NEXT_CLI = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
const PORT        = process.env.PORT || '3000'
const HOSTNAME    = process.env.BIND_HOST || process.env.HOST || '0.0.0.0'
const env         = { ...process.env, PORT, HOSTNAME }

const useStandalone = fs.existsSync(STANDALONE_SERVER_PATH)

if (!useStandalone && !fs.existsSync(NEXT_CLI)) {
  console.error('[startup] Next.js CLI not found. Did dependencies install successfully?')
  process.exit(1)
}

if (!fs.existsSync(PRISMA_CLI)) {
  console.error('[startup] Prisma CLI not found. Did dependencies install successfully?')
  process.exit(1)
}

console.log('[startup] Applying Prisma migrations...')
const migrateSync = spawnSync(
  process.execPath,
  [PRISMA_CLI, 'migrate', 'deploy'],
  { stdio: 'inherit', cwd: ROOT, env }
)

if (migrateSync.error || migrateSync.status !== 0) {
  console.error('[startup] Database migration failed. Startup stopped.')
  process.exit(migrateSync.status ?? 1)
}

const serverArgs = useStandalone
  ? [STANDALONE_SERVER_PATH]
  : [NEXT_CLI, 'start', '-H', HOSTNAME, '-p', PORT]

console.log(
  `[startup] Starting Next.js server on ${HOSTNAME}:${PORT} using ${
    useStandalone ? 'standalone server' : 'next start'
  }...`
)

// Start server immediately; this keeps the process alive and opens the hosting port.
const server = spawn(process.execPath, serverArgs, {
  stdio: 'inherit',
  cwd: ROOT,
  env,
})

server.on('exit', (code) => {
  console.log(`[startup] server.js exited with code ${code}`)
  process.exit(code ?? 1)
})

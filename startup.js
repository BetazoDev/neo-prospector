#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// startup.js - launch Next.js immediately and push Prisma schema in background
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const STANDALONE_SERVER_PATH = path.join(ROOT, '.next', 'standalone', 'server.js')
const NEXT_CLI = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma')
const PRISMA_CLI  = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js')
const DB_URL      = process.env.DATABASE_URL || ''
const PORT        = process.env.PORT || '3000'
const HOSTNAME    = process.env.BIND_HOST || process.env.HOST || '0.0.0.0'
const env         = { ...process.env, PORT, HOSTNAME }

const useStandalone = fs.existsSync(STANDALONE_SERVER_PATH)

if (!useStandalone && !fs.existsSync(NEXT_CLI)) {
  console.error('[startup] Next.js CLI not found. Did dependencies install successfully?')
  process.exit(1)
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

// Push schema asynchronously in background after a brief delay
if (DB_URL) {
  setTimeout(() => {
    console.log('[startup] Running background Prisma schema sync...')
    const prisma = spawn(
      process.execPath,
      [PRISMA_CLI, 'db', 'push', `--schema=${SCHEMA_PATH}`, '--accept-data-loss'],
      { stdio: 'inherit', cwd: ROOT, env }
    )

    prisma.on('error', (err) => {
      console.error('[startup] Schema sync error:', err.message)
    })

    prisma.on('exit', (code) => {
      if (code === 0) {
        console.log('[startup] Schema sync complete')
      } else {
        console.error(`[startup] Schema sync exited with code ${code}`)
      }
    })
  }, 5000)
} else {
  console.warn('[startup] DATABASE_URL not set - skipping schema sync')
}

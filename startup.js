#!/usr/bin/env node
// startup.js — launch Next.js immediately and push Prisma schema in background
const { exec } = require('child_process')
const { spawn } = require('child_process')
const path = require('path')

const SERVER_PATH = path.join(__dirname, '.next', 'standalone', 'server.js')
const SCHEMA_PATH = path.join(__dirname, 'prisma', 'schema.prisma')
const PRISMA_CLI  = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js')
const DB_URL      = process.env.DATABASE_URL || ''

console.log('[startup] Starting Next.js server...')

// Start server immediately — this keeps the process alive and opens port 3000
const server = spawn('node', [SERVER_PATH], {
  stdio: 'inherit',
  env: process.env,
})

server.on('exit', (code) => {
  console.log(`[startup] server.js exited with code ${code}`)
  process.exit(code ?? 1)
})

// Push schema asynchronously in background after a brief delay
if (DB_URL) {
  setTimeout(() => {
    console.log('[startup] Running background Prisma schema sync...')
    exec(
      `node "${PRISMA_CLI}" db push --schema="${SCHEMA_PATH}" --url="${DB_URL}" --accept-data-loss`,
      { env: process.env },
      (err, stdout, stderr) => {
        if (err) {
          console.error('[startup] Schema sync error:', err.message)
          if (stderr) console.error('[startup]', stderr)
        } else {
          console.log('[startup] Schema sync complete ✓')
          if (stdout) console.log('[startup]', stdout)
        }
      }
    )
  }, 5000)
} else {
  console.warn('[startup] DATABASE_URL not set — skipping schema sync')
}

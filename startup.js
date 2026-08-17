#!/usr/bin/env node
// startup.js — start Next.js HTTP server immediately so Docker healthchecks pass without timeout,
// and sync Prisma schema asynchronously in the background.

const { exec } = require('child_process')
const path = require('path')

console.log('[startup] Launching Next.js server on port 3000...')

// Start Next.js server immediately
require('./server.js')

// Run schema push asynchronously in background
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma')
const dbUrl = process.env.DATABASE_URL || ''

if (dbUrl) {
  console.log('[startup] Starting background schema sync with PostgreSQL...')
  const prismaCli = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js')

  exec(
    `node "${prismaCli}" db push --schema="${schemaPath}" --url="${dbUrl}" --accept-data-loss`,
    { env: process.env },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[startup] Background schema sync error:', error.message)
        if (stderr) console.error('[startup] Stderr:', stderr)
      } else {
        console.log('[startup] Background schema sync completed successfully ✓')
      }
    }
  )
} else {
  console.warn('[startup] WARNING: DATABASE_URL not set!')
}

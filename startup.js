#!/usr/bin/env node
// startup.js — runs before server.js to push the Prisma schema to PostgreSQL
// This is a plain JS script, no TypeScript/tsx required.

const { execSync } = require('child_process')
const path = require('path')

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma')

console.log('[startup] Pushing Prisma schema to PostgreSQL...')
console.log('[startup] DATABASE_URL:', process.env.DATABASE_URL ? '✓ set' : '✗ NOT SET')

try {
  execSync(
    `node ${path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js')} db push --schema="${schemaPath}" --skip-generate --accept-data-loss`,
    {
      stdio: 'inherit',
      env: process.env,
    }
  )
  console.log('[startup] Schema push successful ✓')
} catch (err) {
  console.error('[startup] Schema push failed:', err.message)
  console.error('[startup] Continuing anyway — DB may already be up to date')
}

console.log('[startup] Starting Next.js server...')
require('./server.js')

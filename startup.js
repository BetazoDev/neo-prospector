#!/usr/bin/env node
// startup.js — runs before server.js in production to push Prisma schema to PostgreSQL
const { execSync } = require('child_process')
const path = require('path')

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma')
const dbUrl = process.env.DATABASE_URL || ''

console.log('[startup] Pushing Prisma schema to PostgreSQL...')
console.log('[startup] DATABASE_URL present:', Boolean(dbUrl))

if (dbUrl) {
  try {
    const prismaCli = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js')
    execSync(
      `node "${prismaCli}" db push --schema="${schemaPath}" --url="${dbUrl}" --accept-data-loss`,
      {
        stdio: 'inherit',
        env: process.env,
      }
    )
    console.log('[startup] Schema push successful ✓')
  } catch (err) {
    console.error('[startup] Schema push failed:', err.message)
    console.error('[startup] Continuing to server start...')
  }
} else {
  console.warn('[startup] WARNING: DATABASE_URL not set in process environment!')
}

console.log('[startup] Starting Next.js server...')
require('./server.js')

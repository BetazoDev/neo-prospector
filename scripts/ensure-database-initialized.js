#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Blocks accidental use of a fresh database unless an operator explicitly authorizes it.
require('dotenv').config({ path: '.env', override: false, quiet: true })
const { spawnSync } = require('child_process')
const path = require('path')
const { Client } = require('pg')

const ROOT = path.join(__dirname, '..')
const MARKER_KEY = 'primary'
const INITIALIZATION_ALLOWED = process.env.ALLOW_DATABASE_INITIALIZATION === 'true'

function fail(message) {
  console.error(`[database-initialization] ${message}`)
  process.exit(1)
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) fail('DATABASE_URL is required.')

  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 })
  try {
    await client.connect()
    const marker = await client.query(
      'SELECT "initializedAt" FROM "system_state" WHERE "key" = $1',
      [MARKER_KEY]
    )

    if (marker.rowCount) {
      console.log(`[database-initialization] Verified intentional initialization at ${marker.rows[0].initializedAt.toISOString()}.`)
      return
    }

    if (!INITIALIZATION_ALLOWED) {
      fail('Database is missing its initialization marker. Refusing to start against a potentially new or restored database. Restore the expected backup, or set ALLOW_DATABASE_INITIALIZATION=true for exactly one intentional initialization startup and remove it immediately afterwards.')
    }

    if (!process.env.ADMIN_EMAIL?.trim() || !process.env.ADMIN_PASSWORD) {
      fail('ADMIN_EMAIL and ADMIN_PASSWORD are required for an authorized initialization.')
    }

    console.warn('[database-initialization] Authorized initialization requested; ensuring administrator exists.')
    const bootstrap = spawnSync(
      process.execPath,
      [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(ROOT, 'scripts', 'bootstrap-admin.ts')],
      { cwd: ROOT, env: process.env, stdio: 'inherit' }
    )
    if (bootstrap.error || bootstrap.status !== 0) {
      fail(`Administrator bootstrap failed: ${bootstrap.error?.message || `exit ${bootstrap.status}`}`)
    }

    await client.query(
      'INSERT INTO "system_state" ("key") VALUES ($1) ON CONFLICT ("key") DO NOTHING',
      [MARKER_KEY]
    )
    console.log('[database-initialization] Database initialized intentionally. Remove ALLOW_DATABASE_INITIALIZATION before the next restart.')
  } finally {
    await client.end().catch(() => undefined)
  }
}

main().catch((error) => fail(error.message || String(error)))

#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only startup preflight. It never changes schema or application data.
require('dotenv').config({ path: '.env', override: false, quiet: true })
const { Client } = require('pg')

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const DEFAULT_DOKPLOY_DATABASE_HOST = 'neoprospector-neodatabase-eg9c84'
const requireSchema = process.argv.includes('--require-schema')

function fail(message) {
  console.error(`[database-check] ${message}`)
  process.exit(1)
}

function parseTarget() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) fail('DATABASE_URL is required and must be configured as a Dokploy runtime secret.')

  let url
  try {
    url = new URL(connectionString)
  } catch {
    fail('DATABASE_URL is not a valid PostgreSQL connection URL.')
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail('DATABASE_URL must use the postgres:// or postgresql:// protocol.')
  }

  const database = decodeURIComponent(url.pathname.slice(1))
  if (!url.hostname || !database) fail('DATABASE_URL must include a host and database name.')

  const target = { host: url.hostname, port: url.port || '5432', database }
  if (process.env.NODE_ENV === 'production') {
    if (LOCAL_DATABASE_HOSTS.has(target.host.toLowerCase())) {
      fail('DATABASE_URL must not point to localhost in production.')
    }

    const expectedHost = (
      process.env.DATABASE_EXPECTED_HOST?.trim() || DEFAULT_DOKPLOY_DATABASE_HOST
    ).toLowerCase()
    if (target.host.toLowerCase() !== expectedHost) {
      fail(`DATABASE_URL host ${target.host} does not match DATABASE_EXPECTED_HOST.`)
    }
  }

  return { connectionString, target }
}

async function main() {
  const { connectionString, target } = parseTarget()
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 })

  try {
    await client.connect()
    const identity = await client.query('SELECT current_database() AS database')
    if (identity.rows[0].database !== target.database) {
      fail('Connected PostgreSQL database does not match DATABASE_URL.')
    }

    if (!requireSchema) {
      console.log(`[database-check] Connected to PostgreSQL ${target.host}:${target.port}/${target.database}`)
      return
    }

    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY tablename",
      [['users', 'scraping_jobs', 'leads']]
    )
    const foundTables = new Set(tables.rows.map((row) => row.tablename))
    const requiredTables = ['users', 'scraping_jobs', 'leads']
    const missingTables = requiredTables.filter((table) => !foundTables.has(table))
    if (missingTables.length > 0) fail(`Missing required tables after migration: ${missingTables.join(', ')}.`)

    const counts = await client.query(
      'SELECT (SELECT count(*) FROM "users") AS users, (SELECT count(*) FROM "scraping_jobs") AS jobs, (SELECT count(*) FROM "leads") AS leads'
    )
    console.log(
      `[database-check] PostgreSQL ${target.host}:${target.port}/${target.database}; users=${counts.rows[0].users}, jobs=${counts.rows[0].jobs}, leads=${counts.rows[0].leads}`
    )
  } finally {
    await client.end().catch(() => undefined)
  }
}

main().catch((error) => fail(error.message || String(error)))

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const DEFAULT_DOKPLOY_DATABASE_HOST = 'neoprospector-neodatabase-eg9c84'

export interface DatabaseTarget {
  database: string
  host: string
  port: string
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Configure it as a Dokploy runtime secret.')
  }

  return databaseUrl
}

export function getDatabaseTarget(databaseUrl = getDatabaseUrl()): DatabaseTarget {
  let url: URL

  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// protocol.')
  }

  if (!url.hostname || !url.pathname || url.pathname === '/') {
    throw new Error('DATABASE_URL must include a PostgreSQL host and database name.')
  }

  return {
    host: url.hostname,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)),
  }
}

export function validateProductionDatabaseTarget(databaseUrl = getDatabaseUrl()): DatabaseTarget {
  const target = getDatabaseTarget(databaseUrl)

  if (process.env.NODE_ENV !== 'production') return target

  if (LOCAL_DATABASE_HOSTS.has(target.host.toLowerCase())) {
    throw new Error('DATABASE_URL must not point to localhost in production.')
  }

  const expectedHost = (
    process.env.DATABASE_EXPECTED_HOST?.trim() || DEFAULT_DOKPLOY_DATABASE_HOST
  ).toLowerCase()

  if (target.host.toLowerCase() !== expectedHost) {
    throw new Error(`DATABASE_URL host does not match DATABASE_EXPECTED_HOST (${target.host}).`)
  }

  return target
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Configure the production database connection in the deploy environment instead of falling back to localhost.'
    )
  }

  return databaseUrl
}

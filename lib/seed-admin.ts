import { prisma } from './prisma'
import { hashPassword } from './auth'

export async function ensureAdminUser() {
  try {
    // 1. Ensure tables exist idempotently directly via SQL DDL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "apifyApiKey" TEXT,
        "maxLeads" INTEGER NOT NULL DEFAULT 100,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "scraping_jobs" (
        "id" SERIAL NOT NULL,
        "userId" TEXT NOT NULL,
        "name" TEXT,
        "icon" TEXT DEFAULT 'NP',
        "color" TEXT DEFAULT '#7c3aed',
        "niche" TEXT NOT NULL,
        "zone" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "leadsFound" INTEGER NOT NULL DEFAULT 0,
        "apifyRunId" TEXT,
        "error" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "leads" (
        "id" SERIAL NOT NULL,
        "userId" TEXT NOT NULL,
        "jobId" INTEGER NOT NULL,
        "title" TEXT NOT NULL,
        "phone" TEXT,
        "rating" DOUBLE PRECISION,
        "reviewsCount" INTEGER,
        "category" TEXT,
        "address" TEXT,
        "city" TEXT,
        "website" TEXT,
        "mapsUrl" TEXT,
        "searchNiche" TEXT,
        "searchZone" TEXT,
        "countryCode" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
      );
    `)

    // 2. Ensure default admin user exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@diabolicalservices.tech'
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123456'

    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (!existing) {
      const passwordHash = await hashPassword(defaultPassword)
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
        },
      })
      console.log(`[Seed] Admin user created: ${adminEmail}`)
    }
  } catch (err) {
    console.error('[Seed] Error seeding admin user:', err)
    throw err
  }
}

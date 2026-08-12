import { prisma } from './prisma'
import { hashPassword } from './auth'

export async function ensureAdminUser() {
  try {
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
  }
}

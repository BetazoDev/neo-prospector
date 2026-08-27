import { prisma } from './prisma'
import { hashPassword } from './auth'

export async function bootstrapAdminUser() {
  try {
    // Runtime variables take precedence. The fallback preserves the original
    // recovery behavior for this single-admin application when a platform
    // fails to inject its environment file after a restart.
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'admin@diabolicalservices.tech'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456'

    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
    })

    if (!existing) {
      const passwordHash = await hashPassword(adminPassword)
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
        },
      })
      console.log(`[bootstrap] Admin user created: ${adminEmail}`)
    } else {
      console.log(`[bootstrap] Admin user already exists: ${adminEmail}`)
    }
  } catch (err) {
    console.error('[bootstrap] Error bootstrapping admin user:', err)
    throw err
  }
}

import { prisma } from './prisma'
import { hashPassword } from './auth'

export async function bootstrapAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to bootstrap the first administrator.')
    }

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

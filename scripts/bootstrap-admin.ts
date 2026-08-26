import { prisma } from '../lib/prisma'
import { bootstrapAdminUser } from '../lib/seed-admin'

bootstrapAdminUser()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    await prisma.$disconnect()
    console.error(error)
    process.exit(1)
  })

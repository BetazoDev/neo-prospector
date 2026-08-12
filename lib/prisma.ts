import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getFormattedUrl(rawUrl: string): string {
  if (rawUrl.startsWith('file:')) {
    const cleanPath = rawUrl.replace(/^file:/, '').replace(/^\.\//, '')
    const absolutePath = path.isAbsolute(cleanPath)
      ? cleanPath
      : path.join(process.cwd(), /*turbopackIgnore: true*/ cleanPath)
    const normalizedPath = absolutePath.replace(/\\/g, '/')
    return `file:${normalizedPath}`
  }
  return rawUrl
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const url = getFormattedUrl(rawUrl)
  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Public readiness endpoint for Dokploy. It is healthy only when the database
 * is reachable and carries the intentional-initialization marker.
 */
export async function GET() {
  try {
    const state = await prisma.$queryRaw<Array<{ initialized: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM "system_state" WHERE "key" = 'primary'
      ) AS "initialized"
    `

    if (!state[0]?.initialized) {
      return NextResponse.json(
        { status: 'unhealthy', reason: 'database is not initialized' },
        { status: 503 }
      )
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[health] Database readiness check failed:', error)
    return NextResponse.json(
      { status: 'unhealthy', reason: 'database is unavailable' },
      { status: 503 }
    )
  }
}

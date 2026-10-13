import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { dotState } from '@/lib/pipeline/dots'

export const dynamic = 'force-dynamic'

/** Más que esto no se lee como puntos; la fila dice cuántos faltan. */
const MAX_DOTS_PER_BASE = 600

/**
 * Las bases como campos de puntos: un punto por negocio, en orden de llegada, para que el
 * campo se llene en su lugar mientras se revisan los sitios.
 *
 * - `?jobId=12&detail=1`: una base, con id y nombre de cada punto (la página de la base).
 * - `?limit=6`: las bases más recientes (el inicio). Sin límite: todas (la lista de bases).
 */
export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  if (!payload?.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const userId = payload.userId

  const { searchParams } = new URL(req.url)
  const jobIdParam = searchParams.get('jobId')
  const detail = searchParams.get('detail') === '1'
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 200))

  const jobs = await prisma.scrapingJob.findMany({
    where: jobIdParam ? { userId, id: Number(jobIdParam) } : { userId },
    orderBy: { createdAt: 'desc' },
    take: jobIdParam ? 1 : limit,
    select: { id: true, name: true, niche: true, zone: true, status: true, leadsFound: true, createdAt: true, error: true },
  })

  const leads = await prisma.lead.findMany({
    where: { userId, jobId: { in: jobs.map((j) => j.id) } },
    orderBy: { id: 'asc' },
    select: { id: true, jobId: true, title: true, stage: true, checkState: true },
  })

  const bases = jobs.map((job) => {
    const own = leads.filter((l) => l.jobId === job.id)
    const shown = own.slice(0, detail ? own.length : MAX_DOTS_PER_BASE)
    return {
      ...job,
      total: own.length,
      dots: shown.map(dotState).join(''),
      hidden: own.length - shown.length,
      ...(detail ? { items: shown.map((l) => ({ id: l.id, t: l.title })) } : {}),
    }
  })

  return NextResponse.json({ bases })
}

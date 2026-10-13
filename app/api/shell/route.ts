import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { scheduleSiteChecks } from '@/lib/pipeline/site-checks'
import { demoActivity } from '@/lib/pipeline/demo-jobs'

export const dynamic = 'force-dynamic'

/**
 * Lo que la barra superior muestra en todas las pantallas: cuántos negocios hay en cada
 * etapa, las bases recientes y el trabajo de fondo en curso.
 *
 * Como la barra lo consulta seguido, también es el lugar natural para retomar revisiones
 * que quedaron a medias (un reinicio del servidor, por ejemplo): si hay sitios pendientes
 * y nadie los está revisando, se reanudan aquí.
 */
export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  if (!payload?.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const userId = payload.userId

  const [byStage, recent, scraping, checksByJob] = await Promise.all([
    prisma.lead.groupBy({ by: ['stage'], where: { userId }, _count: { _all: true } }),
    prisma.scrapingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, niche: true, zone: true, status: true },
    }),
    prisma.scrapingJob.findMany({
      where: { userId, status: { in: ['running', 'importing'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, niche: true, zone: true, status: true, createdAt: true },
    }),
    prisma.lead.groupBy({
      by: ['jobId', 'checkState'],
      where: { userId, siteKind: 'web' },
      _count: { _all: true },
    }),
  ])

  const stages = Object.fromEntries(byStage.map((row) => [row.stage, row._count._all]))

  // Revisiones por base: solo las que todavía tienen sitios por revisar.
  const perJob = new Map<number, { pending: number; running: number; done: number; total: number }>()
  for (const row of checksByJob) {
    const entry = perJob.get(row.jobId) ?? { pending: 0, running: 0, done: 0, total: 0 }
    const n = row._count._all
    entry.total += n
    if (row.checkState === 'pending') entry.pending += n
    else if (row.checkState === 'running') entry.running += n
    else if (row.checkState === 'done') entry.done += n
    perJob.set(row.jobId, entry)
  }
  const activeChecks = [...perJob.entries()].filter(([, e]) => e.pending + e.running > 0)

  const jobNames = new Map<number, string>()
  if (activeChecks.length) {
    const jobs = await prisma.scrapingJob.findMany({
      where: { userId, id: { in: activeChecks.map(([id]) => id) } },
      select: { id: true, name: true, niche: true, zone: true },
    })
    for (const job of jobs) jobNames.set(job.id, job.name || `${job.niche} · ${job.zone}`)
  }

  for (const [jobId, entry] of activeChecks) {
    if (entry.pending > 0) scheduleSiteChecks({ userId, jobId })
  }

  const demos = await demoActivity(userId)

  const candidatesByJob = await prisma.lead.groupBy({
    by: ['jobId'],
    where: { userId, stage: 'candidate', jobId: { in: recent.map((j) => j.id) } },
    _count: { _all: true },
  })

  return NextResponse.json({
    stages,
    demos,
    recent: recent.map((job) => ({
      id: job.id,
      name: job.name || `${job.niche} · ${job.zone}`,
      status: job.status,
      candidates: candidatesByJob.find((r) => r.jobId === job.id)?._count._all ?? 0,
      checking: (perJob.get(job.id)?.pending ?? 0) + (perJob.get(job.id)?.running ?? 0) > 0,
    })),
    activity: [
      ...scraping.map((job) => ({
        kind: 'scrape' as const,
        jobId: job.id,
        name: job.name || `${job.niche} · ${job.zone}`,
        status: job.status,
        startedAt: job.createdAt,
      })),
      ...demos.running.map((d) => ({
        kind: 'demo' as const,
        jobId: d.baseId,
        leadId: d.leadId,
        name: d.title,
        step: d.step,
      })),
      ...activeChecks.map(([jobId, e]) => ({
        kind: 'checks' as const,
        jobId,
        name: jobNames.get(jobId) ?? `Base #${jobId}`,
        done: e.done,
        total: e.total,
      })),
    ],
  })
}

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { stageForAnalysis, type SiteStatus } from '@/lib/pipeline/analyze-site'
import { scheduleSiteChecks } from '@/lib/pipeline/site-checks'
import { AUTO_STAGES, isSegment, SEGMENTS, type Stage } from '@/lib/pipeline/stages'

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  const payload = await verifyToken(token)
  return payload?.userId ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  // Un solo negocio, para abrir su ficha desde un punto del campo o desde la búsqueda global.
  const single = Number(searchParams.get('id'))
  if (Number.isInteger(single) && single > 0) {
    const lead = await prisma.lead.findFirst({
      where: { id: single, userId },
      include: { job: { select: { id: true, name: true, niche: true, zone: true } } },
    })
    if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ lead })
  }

  const sort = searchParams.get('sort') ?? 'newest'
  const search = searchParams.get('search') ?? ''
  const withPhone = searchParams.get('withPhone') === 'true'
  const jobId = searchParams.get('jobId')
  const segmentParam = searchParams.get('segment')
  const segment = isSegment(segmentParam) ? segmentParam : 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
  const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get('limit') ?? '100') || 100))

  // Always scope to this user
  const scope: Prisma.LeadWhereInput = { userId }
  if (jobId && jobId !== 'all') scope.jobId = parseInt(jobId)

  const where: Prisma.LeadWhereInput = { ...scope }

  if (search) {
    const digits = search.replace(/\D/g, '')
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { domain: { contains: search, mode: 'insensitive' } },
      ...(digits.length >= 4 ? [{ phoneDigits: { contains: digits } }] : []),
    ]
  }

  if (withPhone) {
    where.phone = { not: null }
  }

  const stages = SEGMENTS[segment].stages
  if (stages) where.stage = { in: [...stages] }

  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    sort === 'rating'
      ? [{ rating: { sort: 'desc', nulls: 'last' } }]
      : sort === 'reviews'
        ? [{ reviewsCount: { sort: 'desc', nulls: 'last' } }]
        : sort === 'phone'
          ? [{ phone: { sort: 'asc', nulls: 'last' } }]
          : sort === 'score'
            ? [{ siteScore: { sort: 'desc', nulls: 'last' } }, { reviewsCount: { sort: 'desc', nulls: 'last' } }]
            : [{ createdAt: 'desc' }]

  const [leads, total, aggregate, withPhoneCount, withWebsite, candidates, withWhatsapp] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { job: { select: { id: true, name: true, niche: true, zone: true } } },
    }),
    prisma.lead.count({ where }),
    // Las cifras del encabezado describen la base completa, no el filtro de la tabla.
    prisma.lead.aggregate({
      where: scope,
      _count: { id: true },
      _avg: { rating: true },
      _sum: { reviewsCount: true },
    }),
    prisma.lead.count({ where: { ...scope, phone: { not: null } } }),
    prisma.lead.count({ where: { ...scope, siteKind: 'web' } }),
    prisma.lead.count({ where: { ...scope, stage: 'candidate' } }),
    prisma.lead.count({ where: { ...scope, siteWhatsapp: { isEmpty: false } } }),
  ])

  return NextResponse.json({
    leads,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: {
      total: aggregate._count.id,
      withPhone: withPhoneCount,
      avgRating: aggregate._avg.rating,
      totalReviews: aggregate._sum.reviewsCount,
      withWebsite,
      candidates,
      withWhatsapp,
    },
  })
}

const ACTIONS = ['discard', 'restore', 'recheck', 'promote'] as const
type LeadAction = (typeof ACTIONS)[number]

/** Etapa que le toca a un lead según lo que ya se sabe de él, sin decisiones manuales. */
function automaticStage(lead: { siteKind: string | null; checkState: string | null; siteStatus: string | null; siteScore: number | null }): Stage {
  if (lead.siteKind && lead.siteKind !== 'web') return 'no_site'
  if (lead.checkState !== 'done') return lead.siteKind ? 'to_check' : 'new'
  return stageForAnalysis({ status: (lead.siteStatus ?? 'ok') as SiteStatus, score: lead.siteScore ?? 0 })
}

/** Acciones sobre un lead: descartarlo, devolverlo al embudo, revisarlo otra vez o subirlo a candidato. */
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const action = body?.action as LeadAction
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  const lead = await prisma.lead.findFirst({ where: { id, userId } })
  if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const now = new Date()
  let data: Prisma.LeadUpdateInput
  if (action === 'discard') {
    data = { stage: 'discarded', stageChangedAt: now }
  } else if (action === 'restore') {
    data = { stage: automaticStage(lead), stageChangedAt: now }
  } else if (action === 'promote') {
    data = { stage: 'candidate', stageChangedAt: now }
  } else {
    if (lead.siteKind !== 'web') {
      return NextResponse.json({ error: 'Este prospecto no tiene un sitio propio que revisar.' }, { status: 400 })
    }
    data = {
      checkState: 'pending',
      checkError: null,
      ...(AUTO_STAGES.has(lead.stage as Stage) ? { stage: 'to_check', stageChangedAt: now } : {}),
    }
  }

  const updated = await prisma.lead.update({ where: { id }, data })
  if (action === 'recheck') scheduleSiteChecks({ userId, jobId: lead.jobId })
  return NextResponse.json({ lead: updated })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Verify ownership before delete
  const lead = await prisma.lead.findFirst({ where: { id: parseInt(id), userId } })
  if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.lead.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}

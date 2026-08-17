import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

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
  const sort = searchParams.get('sort') ?? 'newest'
  const search = searchParams.get('search') ?? ''
  const withPhone = searchParams.get('withPhone') === 'true'
  const jobId = searchParams.get('jobId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  // Always scope to this user
  const where: Record<string, unknown> = { userId }

  if (jobId && jobId !== 'all') {
    where.jobId = parseInt(jobId)
  }

  if (search) {
    // PostgreSQL: use 'contains' with mode: 'insensitive' for case-insensitive search
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (withPhone) {
    where.phone = { not: null }
  }

  const orderBy: Record<string, string> =
    sort === 'rating'
      ? { rating: 'desc' }
      : sort === 'reviews'
      ? { reviewsCount: 'desc' }
      : sort === 'phone'
      ? { phone: 'asc' }
      : { createdAt: 'desc' }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ])

  const stats = await prisma.lead.aggregate({
    where,
    _count: { id: true },
    _avg: { rating: true },
    _sum: { reviewsCount: true },
  })

  const withPhoneCount = await prisma.lead.count({
    where: { ...where, phone: { not: null } },
  })

  return NextResponse.json({
    leads,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: {
      total: stats._count.id,
      withPhone: withPhoneCount,
      avgRating: stats._avg.rating,
      totalReviews: stats._sum.reviewsCount,
    },
  })
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

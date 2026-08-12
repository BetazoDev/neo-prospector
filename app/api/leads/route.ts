import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') ?? 'newest'
  const search = searchParams.get('search') ?? ''
  const withPhone = searchParams.get('withPhone') === 'true'
  const jobId = searchParams.get('jobId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const where: Record<string, unknown> = {}

  if (jobId && jobId !== 'all') {
    where.jobId = parseInt(jobId)
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { city: { contains: search } },
      { category: { contains: search } },
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

  // Stats for the active scope
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
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.lead.delete({ where: { id: parseInt(id) } })
  return NextResponse.json({ success: true })
}

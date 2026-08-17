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

  try {
    const jobs = await prisma.scrapingJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { leads: true } },
      },
    })
    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const idParam = searchParams.get('id')
    if (!idParam) return NextResponse.json({ error: 'id param required' }, { status: 400 })

    const jobId = Number(idParam)
    // Verify ownership before delete
    const job = await prisma.scrapingJob.findFirst({ where: { id: jobId, userId } })
    if (!job) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    await prisma.scrapingJob.delete({ where: { id: jobId } })
    return NextResponse.json({ success: true, deletedJobId: jobId })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const idParam = searchParams.get('id')
    if (!idParam) return NextResponse.json({ error: 'id param required' }, { status: 400 })

    const jobId = Number(idParam)
    const body = await req.json()
    const { name } = body

    // Verify ownership
    const job = await prisma.scrapingJob.findFirst({ where: { id: jobId, userId } })
    if (!job) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const updated = await prisma.scrapingJob.update({
      where: { id: jobId },
      data: { name: name ?? job.name },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

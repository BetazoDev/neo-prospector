import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const jobs = await prisma.scrapingJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    })
    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idParam = searchParams.get('id')
    if (!idParam) {
      return NextResponse.json({ error: 'id param required' }, { status: 400 })
    }

    const jobId = Number(idParam)
    // Delete job (cascades to associated leads)
    await prisma.scrapingJob.delete({
      where: { id: jobId },
    })

    return NextResponse.json({ success: true, deletedJobId: jobId })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { syncScrapingJob } from '@/lib/ingest'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * Empuja un job hasta su estado final y devuelve dónde quedó.
 *
 * El formulario de prospección llama a esto en bucle mientras la corrida sigue viva,
 * así que la respuesta describe el progreso real en vez de un mensaje decorativo.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromRequest(req)
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload?.userId) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

  const { jobId: rawJobId } = await params
  const jobId = Number(rawJobId)
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Identificador de base inválido' }, { status: 400 })
  }

  const owned = await prisma.scrapingJob.findFirst({
    where: { id: jobId, userId: payload.userId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  try {
    const outcome = await syncScrapingJob(jobId)

    const job = await prisma.scrapingJob.findUnique({
      where: { id: jobId },
      select: { id: true, name: true, status: true, leadsFound: true, error: true },
    })

    return NextResponse.json({ outcome, job })
  } catch (error) {
    console.error(`[sync] job ${jobId}:`, error)
    return NextResponse.json(
      { error: 'No se pudo consultar el estado de la búsqueda.' },
      { status: 500 }
    )
  }
}

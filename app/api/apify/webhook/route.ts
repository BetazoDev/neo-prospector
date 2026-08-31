import { timingSafeEqual } from 'node:crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncScrapingJob } from '@/lib/ingest'

export const dynamic = 'force-dynamic'

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Aviso de Apify de que una corrida terminó.
 *
 * El cuerpo del webhook no se usa como fuente de verdad: identificamos la base por el
 * secreto de la URL y volvemos a preguntarle a Apify por el estado real de la corrida,
 * así que una llamada falsificada no puede inventar resultados.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const jobId = Number(searchParams.get('jobId'))
  const token = searchParams.get('token') ?? ''

  if (!Number.isInteger(jobId) || jobId <= 0 || !token) {
    return NextResponse.json({ error: 'Solicitud incompleta' }, { status: 400 })
  }

  const job = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    select: { id: true, webhookToken: true },
  })

  if (!job?.webhookToken || !tokensMatch(token, job.webhookToken)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Apify espera una respuesta rápida; la importación puede tardar bastante más.
  after(async () => {
    try {
      await syncScrapingJob(jobId)
    } catch (error) {
      console.error(`[apify-webhook] job ${jobId}:`, error)
    }
  })

  return NextResponse.json({ received: true })
}

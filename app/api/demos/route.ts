import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { cancelDemoJob, demoJobsForLead, enqueueDemos } from '@/lib/pipeline/demo-jobs'

export const dynamic = 'force-dynamic'

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  return payload?.userId ?? null
}

/** Historial de demos de un negocio, para su ficha. */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const leadId = Number(new URL(req.url).searchParams.get('leadId'))
  if (!Number.isInteger(leadId) || leadId <= 0) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })
  return NextResponse.json({ jobs: await demoJobsForLead(userId, leadId) })
}

/**
 * Pone en cola la demo de uno o varios negocios: `{ leadIds }`, o `{ jobId }` para todos los
 * candidatos de una base que todavía no tienen demo.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  let leadIds: number[] = Array.isArray(body.leadIds) ? body.leadIds.filter((n: unknown) => Number.isInteger(n)).slice(0, 500) : []
  if (!leadIds.length && Number.isInteger(body.jobId)) {
    const rows = await prisma.lead.findMany({ where: { userId, jobId: body.jobId, stage: 'candidate' }, select: { id: true } })
    leadIds = rows.map((r) => r.id)
  }
  if (!leadIds.length) return NextResponse.json({ error: 'No hay negocios que poner en cola' }, { status: 400 })

  const queued = await enqueueDemos(userId, leadIds)
  return NextResponse.json({ queued })
}

/** Cancela una demo que todavía no empieza. */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const ok = await cancelDemoJob(userId, id)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Esa demo ya empezó o no existe' }, { status: 409 })
}

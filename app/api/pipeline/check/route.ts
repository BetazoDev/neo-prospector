import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import {
  getCheckProgress,
  processSiteChecks,
  retryFailedChecks,
  type CheckScope,
} from '@/lib/pipeline/site-checks'

export const dynamic = 'force-dynamic'

async function scopeFrom(req: NextRequest): Promise<CheckScope | NextResponse> {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  if (!payload?.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const raw = new URL(req.url).searchParams.get('jobId')
  if (!raw || raw === 'all') return { userId: payload.userId }
  const jobId = Number(raw)
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return NextResponse.json({ error: 'Identificador de base inválido' }, { status: 400 })
  }
  // Todo se filtra además por usuario, así que una base ajena simplemente no tiene leads.
  return { userId: payload.userId, jobId }
}

/** Avance de la revisión de sitios de una base (o de todas). */
export async function GET(req: NextRequest) {
  const scope = await scopeFrom(req)
  if (scope instanceof NextResponse) return scope
  return NextResponse.json(await getCheckProgress(scope))
}

/**
 * Revisa un lote y devuelve el avance. La pantalla lo llama en bucle mientras queden
 * pendientes; la revisión de fondo que arranca al importar hace lo mismo sin pantalla.
 */
export async function POST(req: NextRequest) {
  const scope = await scopeFrom(req)
  if (scope instanceof NextResponse) return scope

  const body = await req.json().catch(() => ({}))
  try {
    if (body?.retryFailed === true) await retryFailedChecks(scope)
    return NextResponse.json(await processSiteChecks(scope))
  } catch (error) {
    console.error('[pipeline/check]', error)
    return NextResponse.json({ error: 'No se pudo avanzar la revisión de sitios.' }, { status: 500 })
  }
}

import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * El worker de la Mac no inicia sesión como persona: se identifica con un secreto
 * compartido (WORKER_TOKEN, igual en el servidor y en el .env del worker) y un nombre de
 * equipo en X-Worker-Id. Sin WORKER_TOKEN configurado, la API del worker no responde.
 * X-Job-Lease es la hora en que tomó el trabajo del que avisa (ver DemoOwner).
 */
export function authenticateWorker(req: NextRequest): { workerId: string; lease: string | null } | NextResponse {
  const expected = process.env.WORKER_TOKEN?.trim()
  if (!expected) {
    return NextResponse.json({ error: 'El worker no está configurado en este servidor (falta WORKER_TOKEN).' }, { status: 503 })
  }

  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const workerId = (req.headers.get('x-worker-id') ?? '').trim().replace(/[^\w.-]/g, '').slice(0, 60)
  if (!workerId) return NextResponse.json({ error: 'Falta X-Worker-Id' }, { status: 400 })
  const lease = req.headers.get('x-job-lease')?.trim().slice(0, 40) || null
  return { workerId, lease }
}

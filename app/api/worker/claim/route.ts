import { NextRequest, NextResponse } from 'next/server'
import { authenticateWorker } from '@/lib/worker-auth'
import { claimDemoJob, touchWorker } from '@/lib/pipeline/demo-jobs'

export const dynamic = 'force-dynamic'

/**
 * El worker llama aquí cada pocos segundos. Siempre cuenta como señal de vida; si pide
 * trabajo (`want: true`) y hay uno en la cola, se lo lleva.
 */
export async function POST(req: NextRequest) {
  const auth = authenticateWorker(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  await touchWorker(auth.workerId, {
    version: typeof body.version === 'string' ? body.version : undefined,
    running: Number.isInteger(body.running) ? body.running : undefined,
    capacity: Number.isInteger(body.capacity) ? body.capacity : undefined,
    pausedUntil: typeof body.pausedUntil === 'string' || body.pausedUntil === null ? body.pausedUntil : undefined,
    pauseReason: body.pauseReason === 'auth' || body.pauseReason === 'limit' ? body.pauseReason : body.pauseReason === null ? null : undefined,
  })

  if (body.want !== true) return NextResponse.json({ job: null })
  const job = await claimDemoJob(auth.workerId)
  return NextResponse.json({ job })
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticateWorker } from '@/lib/worker-auth'
import { DemoJobConflict, finishDemoJob, type DemoOutcome } from '@/lib/pipeline/demo-jobs'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

function parseOutcome(body: Record<string, unknown> | null): DemoOutcome | null {
  if (!body) return null
  const text = typeof body.text === 'string' ? body.text : ''
  if (body.outcome === 'published' && typeof body.demoUrl === 'string' && typeof body.slug === 'string') {
    // Solo enlaces del sitio de demos: la ficha y los mensajes de WhatsApp los muestran tal cual.
    const base = process.env.DEMOS_BASE_URL?.trim() || 'https://demos.diabolicalservices.tech/'
    try {
      const url = new URL(body.demoUrl)
      if (url.protocol !== 'https:' || !url.toString().startsWith(base)) return null
    } catch {
      return null
    }
    return { outcome: 'published', demoUrl: body.demoUrl, slug: body.slug.slice(0, 60), text: text || undefined }
  }
  if (body.outcome === 'skipped' && text) return { outcome: 'skipped', text, audit: (body.audit as never) ?? undefined }
  const retryAfterMs = typeof body.retryAfterMs === 'number' ? Math.min(Math.max(body.retryAfterMs, 0), 24 * 3600_000) : undefined
  if (body.outcome === 'released' && text) return { outcome: 'released', text, retryAfterMs }
  if (body.outcome === 'failed' && text) {
    return {
      outcome: 'failed',
      text,
      retryable: body.retryable !== false,
      retryAfterMs,
    }
  }
  return null
}

/** Cierre del trabajo: demo publicada, auditoría que dijo que no, fallo (con reintento) o devuelto a la cola. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = authenticateWorker(req)
  if (auth instanceof NextResponse) return auth

  const id = Number((await params).id)
  const outcome = parseOutcome(await req.json().catch(() => null))
  if (!Number.isInteger(id) || !outcome) return NextResponse.json({ error: 'Resultado inválido' }, { status: 400 })

  try {
    await finishDemoJob(id, auth, outcome)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DemoJobConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    throw error
  }
}

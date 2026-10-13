import { NextRequest, NextResponse } from 'next/server'
import { authenticateWorker } from '@/lib/worker-auth'
import { DemoJobConflict, heartbeatDemoJob, isDemoStep, recordDemoEvent } from '@/lib/pipeline/demo-jobs'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Un paso del trabajo: avanza la etapa del negocio y deja el mensaje en su ficha. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = authenticateWorker(req)
  if (auth instanceof NextResponse) return auth

  const id = Number((await params).id)
  const body = await req.json().catch(() => null)
  if (Number.isInteger(id) && body?.quiet === true) {
    try {
      await heartbeatDemoJob(id, auth)
      return NextResponse.json({ ok: true })
    } catch (error) {
      if (error instanceof DemoJobConflict) return NextResponse.json({ error: error.message }, { status: 409 })
      throw error
    }
  }
  if (!Number.isInteger(id) || typeof body?.text !== 'string') {
    return NextResponse.json({ error: 'Solicitud incompleta' }, { status: 400 })
  }

  try {
    await recordDemoEvent(id, auth, {
      text: body.text,
      step: isDemoStep(body.step) ? body.step : undefined,
      slug: typeof body.slug === 'string' ? body.slug.slice(0, 60) : undefined,
      audit: body.audit ?? undefined,
      research: body.research ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DemoJobConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    throw error
  }
}

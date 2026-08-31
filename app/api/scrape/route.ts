import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { launchApifyScrape, resolveCountryCode } from '@/lib/apify'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4']

function initialsFor(text: string, fallback: string): string {
  const initials = text
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
  return initials || fallback
}

function colorFor(text: string): string {
  const sum = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return PALETTE[sum % PALETTE.length]
}

/** Apify solo puede avisarnos si la app es alcanzable desde internet. */
function webhookUrlFor(jobId: number, token: string): string | null {
  const base = process.env.APP_URL?.trim()
  if (!base) return null

  try {
    const url = new URL(`/api/apify/webhook`, base)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.searchParams.set('jobId', String(jobId))
    url.searchParams.set('token', token)
    return url.toString()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const authToken = getTokenFromRequest(req)
  if (!authToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await verifyToken(authToken)
  if (!payload?.userId) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

  const userId = payload.userId

  const body = await req.json().catch(() => null)
  const niche = typeof body?.niche === 'string' ? body.niche.trim() : ''
  const zone = typeof body?.zone === 'string' ? body.zone.trim() : ''

  if (!niche || !zone) {
    return NextResponse.json({ error: 'Nicho y zona son requeridos' }, { status: 400 })
  }
  if (niche.length > 120 || zone.length > 120) {
    return NextResponse.json({ error: 'Nicho y zona no pueden superar 120 caracteres' }, { status: 400 })
  }

  // La clave y el límite viven en el servidor: el navegador no necesita conocerlos.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apifyApiKey: true, maxLeads: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'Tu sesión ya no corresponde a un usuario existente. Vuelve a iniciar sesión.' },
      { status: 401 }
    )
  }

  const apiKey = user.apifyApiKey?.trim() || process.env.APIFY_API_KEY?.trim() || ''
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Se requiere una API Key de Apify. Configúrala en Ajustes.' },
      { status: 400 }
    )
  }

  const maxLeads = user.maxLeads > 0 ? user.maxLeads : 100
  const webhookToken = randomUUID()

  const job = await prisma.scrapingJob.create({
    data: {
      userId,
      niche,
      zone,
      status: 'running',
      name: `${niche} · ${zone}`,
      icon: initialsFor(niche, 'NP'),
      color: colorFor(niche),
      webhookToken,
    },
  })

  try {
    // Orientativo: si no se resuelve, la búsqueda sigue sin acotar por país.
    const countryCode = await resolveCountryCode(zone)

    const runId = await launchApifyScrape({
      niche,
      zone,
      maxLeads,
      apiKey,
      countryCode,
      webhookUrl: webhookUrlFor(job.id, webhookToken),
    })

    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: { apifyRunId: runId },
    })

    // La extracción sigue en Apify. El cliente la sigue con /api/jobs/[jobId]/sync.
    return NextResponse.json(
      { jobId: job.id, runId, status: 'running', maxLeads, countryCode },
      { status: 202 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[scrape] launch failed:', error)

    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: { status: 'error', error: message.slice(0, 500) },
    })

    return NextResponse.json({ error: message, jobId: job.id }, { status: 502 })
  }
}

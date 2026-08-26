import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geocodeZone, launchApifyScrape, pollApifyRun, fetchApifyResults } from '@/lib/apify'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.userId) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const userId = payload.userId

    const { niche, zone, maxLeads, apiKey } = await req.json()
    if (!niche || !zone) {
      return NextResponse.json({ error: 'Nicho y zona son requeridos' }, { status: 400 })
    }

    // Resolve API key: request body → user DB record → env var
    let effectiveKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : ''

    if (!effectiveKey) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apifyApiKey: true },
      })
      if (user?.apifyApiKey) effectiveKey = user.apifyApiKey
    }

    if (!effectiveKey) effectiveKey = process.env.APIFY_API_KEY || ''

    if (!effectiveKey) {
      return NextResponse.json(
        { error: 'Se requiere una API Key de Apify. Configúrala en Ajustes.' },
        { status: 400 }
      )
    }

    const parsedMaxLeads = typeof maxLeads === 'number' && maxLeads > 0 ? maxLeads : 100

    // Generate icon (2 first letters of niche, uppercased)
    const icon = niche
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'NP'

    // Pick a consistent color based on niche string hash
    const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4']
    const colorIdx = niche.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) % PALETTE.length
    const color = PALETTE[colorIdx]

    // Create job record with userId + display fields
    const job = await prisma.scrapingJob.create({
      data: {
        userId,
        niche,
        zone,
        status: 'running',
        name: `${niche} · ${zone}`,
        icon,
        color,
      },
    })

    try {
      const { lat, lon, countryCode } = await geocodeZone(zone)
      const runId = await launchApifyScrape(niche, zone, lat, lon, parsedMaxLeads, effectiveKey)

      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { apifyRunId: runId },
      })

      const datasetId = await pollApifyRun(runId, effectiveKey)
      const leads = await fetchApifyResults(datasetId, countryCode, effectiveKey)

      const created = await prisma.$transaction(
        leads.map((lead) =>
          prisma.lead.create({
            data: {
              userId,
              jobId: job.id,
              title: lead.title ?? 'Sin nombre',
              phone: lead.phone ?? null,
              rating: lead.totalScore ?? null,
              reviewsCount: lead.reviewsCount ?? null,
              category: lead.categoryName ?? null,
              address: lead.address ?? null,
              city: lead.city ?? null,
              website: lead.website ?? null,
              mapsUrl: lead.url ?? null,
              searchNiche: niche,
              searchZone: zone,
              countryCode,
            },
          })
        )
      )

      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { status: 'done', leadsFound: created.length },
      })

      return NextResponse.json({ success: true, jobId: job.id, count: created.length })
    } catch (err) {
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { status: 'error', error: String(err) },
      })
      throw err
    }
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

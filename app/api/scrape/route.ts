import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geocodeZone, launchApifyScrape, pollApifyRun, fetchApifyResults } from '@/lib/apify'

export async function POST(req: NextRequest) {
  try {
    const { niche, zone, maxLeads, apiKey } = await req.json()
    if (!niche || !zone) {
      return NextResponse.json({ error: 'Nicho y zona son requeridos' }, { status: 400 })
    }

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Se requiere una API Key de Apify para continuar. Por favor ingresa tu API Key en la sección de Configuración.' },
        { status: 400 }
      )
    }

    const effectiveKey = apiKey.trim()
    const parsedMaxLeads = typeof maxLeads === 'number' && maxLeads > 0 ? maxLeads : 100

    // Create job record
    const job = await prisma.scrapingJob.create({
      data: { niche, zone, status: 'running' },
    })

    try {
      // 1. Geocode the zone
      const { lat, lon, countryCode } = await geocodeZone(zone)

      // 2. Launch Apify actor with user's custom maxLeads and key
      const runId = await launchApifyScrape(niche, zone, lat, lon, parsedMaxLeads, effectiveKey)
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { apifyRunId: runId },
      })

      // 3. Poll for completion
      const datasetId = await pollApifyRun(runId, effectiveKey)

      // 4. Fetch and filter results
      const leads = await fetchApifyResults(datasetId, countryCode, effectiveKey)

      // 5. Save to DB linked to job.id
      const created = await prisma.$transaction(
        leads.map((lead) =>
          prisma.lead.create({
            data: {
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
              jobId: job.id,
            },
          })
        )
      )

      // Update job status
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { status: 'done', leadsFound: created.length },
      })

      return NextResponse.json({
        success: true,
        jobId: job.id,
        count: created.length,
        leads: created,
      })
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

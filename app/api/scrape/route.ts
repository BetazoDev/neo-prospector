import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geocodeZone, launchApifyScrape, pollApifyRun, fetchApifyResults } from '@/lib/apify'

export async function POST(req: NextRequest) {
  try {
    const { niche, zone } = await req.json()
    if (!niche || !zone) {
      return NextResponse.json({ error: 'niche and zone are required' }, { status: 400 })
    }

    if (!process.env.APIFY_API_KEY || process.env.APIFY_API_KEY === 'your_apify_api_key_here') {
      return NextResponse.json({ error: 'APIFY_API_KEY not configured' }, { status: 500 })
    }

    // Create job record
    const job = await prisma.scrapingJob.create({
      data: { niche, zone, status: 'running' },
    })

    try {
      // 1. Geocode the zone
      const { lat, lon, countryCode } = await geocodeZone(zone)

      // 2. Launch Apify actor
      const runId = await launchApifyScrape(niche, zone, lat, lon)
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: { apifyRunId: runId },
      })

      // 3. Poll for completion
      const datasetId = await pollApifyRun(runId)

      // 4. Fetch and filter results
      const leads = await fetchApifyResults(datasetId, countryCode)

      // 5. Save to DB
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

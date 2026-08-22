import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import Papa from 'papaparse'

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  const payload = await verifyToken(token)
  return payload?.userId ?? null
}

// Map flexible CSV column names to our Lead fields
function mapRow(row: Record<string, string>) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
      if (val !== undefined && val !== '') return val.trim()
    }
    return null
  }

  const ratingRaw = get('Rating', 'rating', 'Calificación', 'calificacion')
  const reviewsRaw = get('Reseñas', 'Resenas', 'Reviews', 'reviewsCount', 'reviews_count')

  return {
    title: get('Empresa', 'empresa', 'Title', 'title', 'Name', 'name', 'Business') ?? 'Sin nombre',
    phone: get('Teléfono', 'Telefono', 'Phone', 'phone', 'tel'),
    rating: ratingRaw ? parseFloat(ratingRaw) : null,
    reviewsCount: reviewsRaw ? parseInt(reviewsRaw, 10) : null,
    category: get('Categoría', 'Categoria', 'Category', 'category'),
    address: get('Dirección', 'Direccion', 'Address', 'address'),
    city: get('Ciudad', 'City', 'city'),
    website: get('Sitio Web', 'Website', 'website', 'url'),
    mapsUrl: get('Google Maps', 'Maps', 'mapsUrl', 'maps_url'),
    searchNiche: get('Nicho', 'niche', 'searchNiche'),
    searchZone: get('Zona', 'zone', 'searchZone'),
    countryCode: get('País', 'Country', 'countryCode', 'country_code'),
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const customName = formData.get('name') as string | null

    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .csv' }, { status: 400 })
    }

    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    })

    if (!parsed.data || parsed.data.length === 0) {
      return NextResponse.json({ error: 'El CSV está vacío o no tiene datos válidos' }, { status: 400 })
    }

    // Derive niche/zone from first data row if available
    const firstRow = parsed.data[0]
    const sampleNiche = firstRow['Nicho'] ?? firstRow['niche'] ?? firstRow['searchNiche'] ?? 'CSV Import'
    const sampleZone = firstRow['Zona'] ?? firstRow['zone'] ?? firstRow['searchZone'] ?? ''

    // Generate icon + color same as scraper
    const baseName = customName?.trim() || file.name.replace(/\.csv$/i, '')
    const icon = baseName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'CS'

    const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4']
    const colorIdx = baseName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % PALETTE.length
    const color = PALETTE[colorIdx]

    // Create the job record
    const job = await prisma.scrapingJob.create({
      data: {
        userId,
        niche: sampleNiche,
        zone: sampleZone,
        status: 'running',
        name: baseName,
        icon,
        color,
      },
    })

    // Insert all leads
    const leadsData = parsed.data.map((row) => {
      const mapped = mapRow(row)
      return {
        userId,
        jobId: job.id,
        ...mapped,
        rating: isNaN(mapped.rating as number) ? null : mapped.rating,
        reviewsCount: isNaN(mapped.reviewsCount as number) ? null : mapped.reviewsCount,
      }
    })

    const created = await prisma.$transaction(
      leadsData.map((lead) => prisma.lead.create({ data: lead }))
    )

    await prisma.scrapingJob.update({
      where: { id: job.id },
      data: { status: 'done', leadsFound: created.length },
    })

    return NextResponse.json({ success: true, jobId: job.id, count: created.length })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

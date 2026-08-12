const ACTOR_ID = 'nwua9Gu5YrADL7ZDj'

interface GeocodingResult {
  lat: string
  lon: string
  countryCode: string
}

interface ApifyLead {
  title?: string
  phone?: string
  totalScore?: number
  reviewsCount?: number
  categoryName?: string
  address?: string
  city?: string
  website?: string
  url?: string
  countryCode?: string
  location?: { lat: number; lng: number }
}

export async function geocodeZone(zone: string): Promise<GeocodingResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zone)}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'NeoProspector/1.0' },
  })
  const data = await res.json()
  if (!data || data.length === 0) throw new Error(`No se pudo geocodificar la zona: ${zone}`)
  const result = data[0]

  const addressUrl = `https://nominatim.openstreetmap.org/reverse?lat=${result.lat}&lon=${result.lon}&format=json`
  const addrRes = await fetch(addressUrl, {
    headers: { 'User-Agent': 'NeoProspector/1.0' },
  })
  const addrData = await addrRes.json()
  const countryCode = addrData?.address?.country_code?.toLowerCase() ?? 'xx'

  return { lat: result.lat, lon: result.lon, countryCode }
}

export async function launchApifyScrape(
  niche: string,
  zone: string,
  lat: string,
  lon: string,
  maxLeads: number = 100,
  customApiKey?: string
): Promise<string> {
  const apiKey = customApiKey || process.env.APIFY_API_KEY
  if (!apiKey) throw new Error('No se ha configurado la API Key de Apify')

  const searchString = `${niche} en ${zone}`
  const body = {
    language: 'es',
    maxCrawledPlacesPerSearch: maxLeads,
    searchStringsArray: [searchString],
    lat,
    lng: lon,
    zoom: 12,
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Apify error: ${err}`)
  }

  const data = await res.json()
  return data.data.id as string
}

export async function pollApifyRun(runId: string, customApiKey?: string, maxWaitMs = 300000): Promise<string> {
  const apiKey = customApiKey || process.env.APIFY_API_KEY
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`
    )
    const data = await res.json()
    const status = data.data?.status as string
    if (status === 'SUCCEEDED') return data.data.defaultDatasetId as string
    if (status === 'FAILED' || status === 'ABORTED') throw new Error(`Apify run failed: ${status}`)
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('Apify run timed out after 5 minutes')
}

export async function fetchApifyResults(datasetId: string, countryCode: string, customApiKey?: string): Promise<ApifyLead[]> {
  const apiKey = customApiKey || process.env.APIFY_API_KEY
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}&format=json`
  )
  const items = (await res.json()) as ApifyLead[]
  return items.filter((item) => {
    const itemCC = item.countryCode?.toLowerCase() ?? ''
    return itemCC === countryCode || itemCC === ''
  })
}

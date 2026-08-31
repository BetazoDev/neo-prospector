const ACTOR_ID = 'nwua9Gu5YrADL7ZDj'
const APIFY_API = 'https://api.apify.com/v2'

/** Página de descarga del dataset. El endpoint no tiene tope propio, así que lo ponemos nosotros. */
const DATASET_PAGE_SIZE = 1000
/** Techo defensivo para no volcar un dataset gigante en memoria. */
const DATASET_MAX_ITEMS = 50000

/** Nominatim pide como máximo una petición por segundo. */
const NOMINATIM_MIN_INTERVAL_MS = 1100

export interface ApifyLead {
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

export interface ApifyRunState {
  status: string
  datasetId: string | null
}

/** Estados de Apify en los que la corrida sigue viva y todavía no hay resultados. */
export const APIFY_PENDING_STATUSES = new Set(['READY', 'RUNNING'])

/** Error de una llamada a Apify que conserva el código HTTP, para distinguir un problema
 *  pasajero de red de una clave inválida o una corrida que ya no existe. */
export class ApifyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'ApifyRequestError'
  }

  /** Reintentar no va a arreglar esto. */
  get isTerminal(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404
  }
}

const countryCodeCache = new Map<string, string | null>()
let nominatimLastCallAt = 0

async function throttleNominatim() {
  const waitMs = nominatimLastCallAt + NOMINATIM_MIN_INTERVAL_MS - Date.now()
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
  nominatimLastCallAt = Date.now()
}

/**
 * Deduce el país de una zona escrita a mano, solo para acotar la búsqueda en el actor.
 *
 * Es orientativo: si Nominatim no responde o la zona es ambigua devolvemos `null` y la
 * búsqueda sigue adelante sin el filtro de país. Nunca lanza, porque un fallo aquí no
 * debe impedir una extracción.
 */
export async function resolveCountryCode(zone: string): Promise<string | null> {
  const key = zone.trim().toLowerCase()
  if (!key) return null

  const cached = countryCodeCache.get(key)
  if (cached !== undefined) return cached

  try {
    await throttleNominatim()
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(zone)}&format=json&limit=1&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NeoProspector/1.0 (prospector.diabolicalservices.tech)' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      countryCodeCache.set(key, null)
      return null
    }

    const data = await res.json()
    const code = data?.[0]?.address?.country_code
    const resolved = typeof code === 'string' && code.length === 2 ? code.toLowerCase() : null
    countryCodeCache.set(key, resolved)
    return resolved
  } catch {
    countryCodeCache.set(key, null)
    return null
  }
}

function buildWebhooksParam(webhookUrl: string): string {
  const definitions = [
    {
      eventTypes: [
        'ACTOR.RUN.SUCCEEDED',
        'ACTOR.RUN.FAILED',
        'ACTOR.RUN.ABORTED',
        'ACTOR.RUN.TIMED_OUT',
      ],
      requestUrl: webhookUrl,
    },
  ]
  return Buffer.from(JSON.stringify(definitions), 'utf8').toString('base64')
}

export interface LaunchOptions {
  niche: string
  zone: string
  maxLeads: number
  apiKey: string
  /** Código ISO de dos letras. Opcional: acota la búsqueda en origen. */
  countryCode?: string | null
  /** URL pública que Apify llamará al terminar. Si falta, solo queda la reconciliación. */
  webhookUrl?: string | null
}

/**
 * Lanza la corrida y devuelve su id sin esperar a que termine.
 *
 * `locationQuery` es el campo de ubicación real del actor: acepta ciudad, estado o país
 * y el propio actor subdivide las áreas grandes en subregiones. El término de búsqueda
 * va limpio, sin la zona pegada, que es como el actor espera recibirlo.
 */
export async function launchApifyScrape({
  niche,
  zone,
  maxLeads,
  apiKey,
  countryCode,
  webhookUrl,
}: LaunchOptions): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('API Key de Apify no configurada. Ingresa una clave válida en Configuración.')
  }

  const input: Record<string, unknown> = {
    language: 'es',
    searchStringsArray: [niche.trim()],
    locationQuery: zone.trim(),
    maxCrawledPlacesPerSearch: maxLeads,
  }

  if (countryCode) input.countryCode = countryCode

  const params = new URLSearchParams({ token: apiKey.trim() })
  if (webhookUrl) params.set('webhooks', buildWebhooksParam(webhookUrl))

  const res = await fetch(`${APIFY_API}/acts/${ACTOR_ID}/runs?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Apify rechazó la búsqueda (${res.status}). ${detail.slice(0, 300)}`.trim())
  }

  const data = await res.json().catch(() => null)
  const runId = data?.data?.id
  if (typeof runId !== 'string' || !runId) {
    throw new Error('Apify aceptó la búsqueda pero no devolvió un identificador de corrida.')
  }

  return runId
}

/** Consulta el estado de una corrida. Distingue un fallo de red de una corrida en curso. */
export async function getApifyRun(runId: string, apiKey: string): Promise<ApifyRunState> {
  const res = await fetch(
    `${APIFY_API}/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(apiKey.trim())}`
  )

  if (!res.ok) {
    const reason =
      res.status === 401 || res.status === 403
        ? 'La API Key de Apify fue rechazada.'
        : res.status === 404
          ? 'Apify ya no encuentra esta corrida.'
          : `No se pudo consultar la corrida en Apify (HTTP ${res.status}).`
    throw new ApifyRequestError(reason, res.status)
  }

  const data = await res.json().catch(() => null)
  const status = data?.data?.status
  if (typeof status !== 'string') {
    throw new ApifyRequestError('Apify devolvió un estado de corrida ilegible.', res.status)
  }

  const datasetId = data?.data?.defaultDatasetId
  return { status, datasetId: typeof datasetId === 'string' ? datasetId : null }
}

/** Descarga el dataset por páginas para no cargar una extracción grande de golpe. */
export async function fetchApifyResults(datasetId: string, apiKey: string): Promise<ApifyLead[]> {
  const token = encodeURIComponent(apiKey.trim())
  const items: ApifyLead[] = []
  let offset = 0

  while (items.length < DATASET_MAX_ITEMS) {
    const res = await fetch(
      `${APIFY_API}/datasets/${encodeURIComponent(datasetId)}/items` +
        `?token=${token}&format=json&limit=${DATASET_PAGE_SIZE}&offset=${offset}`
    )

    if (!res.ok) {
      throw new Error(`No se pudo descargar el dataset de Apify (HTTP ${res.status}).`)
    }

    const batch = await res.json().catch(() => null)
    if (!Array.isArray(batch) || batch.length === 0) break

    items.push(...(batch as ApifyLead[]))
    if (batch.length < DATASET_PAGE_SIZE) break
    offset += batch.length
  }

  return items
}

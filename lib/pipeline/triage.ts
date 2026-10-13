/**
 * Clasificación inmediata de un lead con los datos que trae Maps, sin tocar la red:
 * qué tipo de sitio tiene, su dominio, su teléfono listo para WhatsApp y la etapa con la
 * que entra al embudo.
 */

export type SiteKind = 'web' | 'social' | 'whatsapp' | 'none'

/** Hosts que no son el sitio del negocio sino un perfil en otra plataforma. */
const SOCIAL_HOSTS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'linktr.ee',
  'linktree.com',
  'beacons.ai',
  'taplink.cc',
  'doctoralia.com.mx',
  'google.com',
  'maps.app.goo.gl',
  'goo.gl',
  'g.page',
]

const WHATSAPP_HOSTS = ['wa.me', 'api.whatsapp.com', 'whatsapp.com', 'wa.link']

/** Hosts compartidos por muchos negocios: el dominio no basta para identificar el sitio. */
const SHARED_HOSTS = ['sites.google.com']

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`))
}

export interface NormalizedWebsite {
  url: string
  host: string
}

export function normalizeWebsite(raw: string | null | undefined): NormalizedWebsite | null {
  const value = raw?.trim()
  if (!value) return null

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return { url: url.toString(), host: url.hostname.toLowerCase() }
  } catch {
    return null
  }
}

export function classifyWebsite(raw: string | null | undefined): {
  kind: SiteKind
  domain: string | null
  whatsapp: string | null
} {
  const site = normalizeWebsite(raw)
  if (!site) return { kind: 'none', domain: null, whatsapp: null }

  const bare = site.host.replace(/^www\./, '')
  // Antes que las redes: sites.google.com también termina en google.com.
  if (SHARED_HOSTS.includes(bare)) {
    const firstSegments = new URL(site.url).pathname.split('/').filter(Boolean).slice(0, 2).join('/')
    return { kind: 'web', domain: firstSegments ? `${bare}/${firstSegments}` : bare, whatsapp: null }
  }
  if (hostMatches(site.host, WHATSAPP_HOSTS)) {
    return { kind: 'whatsapp', domain: null, whatsapp: extractWhatsappNumbers(site.url)[0] ?? null }
  }
  if (hostMatches(site.host, SOCIAL_HOSTS)) return { kind: 'social', domain: null, whatsapp: null }

  return { kind: 'web', domain: bare, whatsapp: null }
}

/**
 * Deja un teléfono como lo espera wa.me: solo dígitos y con código de país.
 *
 * México dejó de usar el "1" de celular después del 52 en 2019, pero muchos listados lo
 * conservan; wa.me funciona sin él. Un número de 10 dígitos sin prefijo se asume del país
 * de la búsqueda cuando es México, que es el caso de casi todas las bases.
 */
export function phoneToDigits(raw: string | null | undefined, countryCode?: string | null): string | null {
  const value = raw?.trim()
  if (!value) return null

  let digits = value.replace(/\D/g, '')
  if (value.startsWith('00')) digits = digits.slice(2)

  // Los CSV a veces traen el país escrito ("México") en vez del código.
  const rawCountry = countryCode?.trim().toLowerCase() || null
  const country = rawCountry && rawCountry.length > 2 && /^m[eé]x/.test(rawCountry) ? 'mx' : rawCountry
  const hasPlus = value.startsWith('+') || value.startsWith('00')
  if (!hasPlus && digits.length === 10 && (country === 'mx' || country === null)) digits = `52${digits}`
  if (digits.startsWith('521') && digits.length === 13) digits = `52${digits.slice(3)}`

  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

/** Números que aparecen en enlaces de WhatsApp dentro de un texto o HTML. */
export function extractWhatsappNumbers(text: string): string[] {
  const found = new Set<string>()
  const pattern =
    /(?:wa\.me\/|whatsapp\.com\/send\/?\?(?:[^"'\s<>]*?&(?:amp;)?)?phone=|whatsapp:\/\/send\/?\?(?:[^"'\s<>]*?&(?:amp;)?)?phone=)(?:%2B|\+)?([\d][\d\s.()%-]{7,24})/gi
  for (const match of text.matchAll(pattern)) {
    const digits = phoneToDigits(match[1].replace(/%20/g, ' '), null)
    if (digits) found.add(digits)
  }
  return [...found]
}

/** Identificador estable del lugar: el que manda Apify o el de la URL de Maps. */
export function placeIdFrom(explicit: string | null | undefined, mapsUrl: string | null | undefined): string | null {
  if (explicit?.trim()) return explicit.trim()
  if (!mapsUrl) return null
  try {
    const url = new URL(mapsUrl)
    return url.searchParams.get('query_place_id') || url.searchParams.get('place_id') || null
  } catch {
    return null
  }
}

export interface TriageInput {
  website: string | null
  phone: string | null
  mapsUrl: string | null
  countryCode: string | null
  placeId?: string | null
}

export function triageLead(input: TriageInput) {
  const site = classifyWebsite(input.website)
  const hasOwnSite = site.kind === 'web'

  return {
    siteKind: site.kind,
    domain: site.domain,
    phoneDigits: phoneToDigits(input.phone, input.countryCode),
    placeId: placeIdFrom(input.placeId, input.mapsUrl),
    siteWhatsapp: site.whatsapp ? [site.whatsapp] : [],
    stage: hasOwnSite ? 'to_check' : 'no_site',
    checkState: hasOwnSite ? 'pending' : 'skipped',
  }
}

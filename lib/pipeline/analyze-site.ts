import { FetchFailure, type FetchedPage } from './fetch-site'
import { classifyWebsite, extractWhatsappNumbers } from './triage'

/**
 * Lectura automática de la home de un lead: qué tan roto, viejo o incompleto está el
 * sitio. Es la primera criba y es barata (una sola petición, sin navegador ni IA); la
 * auditoría visual de la fase siguiente afina a los que pasen.
 *
 * Cada hallazgo suma un peso. El total (0-100) es la "oportunidad": más alto, más
 * evidente que el negocio necesita un sitio nuevo. Las etiquetas se muestran tal cual en
 * la interfaz y luego sirven para redactar el primer mensaje, así que dicen lo que se ve.
 */

export type SiteStatus = 'ok' | 'broken' | 'dead' | 'parked' | 'construction' | 'hacked' | 'social' | 'unverified'

export interface SiteIssue {
  code: string
  label: string
  weight: number
}

export interface SiteAnalysis {
  status: SiteStatus
  httpStatus: number | null
  finalUrl: string | null
  title: string | null
  cms: string | null
  issues: SiteIssue[]
  score: number
  whatsapp: string[]
}

/** Desde aquí un sitio se considera candidato a rediseño. */
export const CANDIDATE_SCORE = 30

const CMS_PATTERNS: [string, RegExp][] = [
  ['WordPress', /wp-content\/|wp-includes\//i],
  ['Wix', /static\.wixstatic\.com|wix\.com\/|x-wix-/i],
  ['Squarespace', /squarespace\.com|static1\.squarespace/i],
  ['GoDaddy Website Builder', /img1\.wsimg\.com|godaddysites\.com/i],
  ['Webnode', /webnode\./i],
  ['Jimdo', /jimdo(free)?\.com|jimcdn\.com/i],
  ['Weebly', /weebly\.com|editmysite\.com/i],
  ['Hostinger Website Builder', /zyrosite\.com|zyro\.com|userapp\.zyrosite/i],
  ['Google Sites', /sites\.google\.com/i],
  ['Blogger', /blogger\.com|blogspot\.com/i],
  ['Joomla', /\/media\/jui\/|\/components\/com_[a-z]+/i],
  ['Drupal', /drupal-settings-json|\/sites\/default\/files\//i],
  ['Shopify', /cdn\.shopify\.com/i],
  ['Webflow', /webflow\.(com|io)|data-wf-page/i],
  ['Framer', /framerusercontent\.com|framer\.com\/m\//i],
  ['Next.js', /\/_next\/static\//i],
  ['Astro', /\/_astro\//i],
  ['Adobe Muse', /adobe muse|musecdn/i],
]

/** Constructores que suelen dar sitios genéricos o limitados. */
const BUILDERS = new Set([
  'Wix',
  'GoDaddy Website Builder',
  'Webnode',
  'Jimdo',
  'Weebly',
  'Hostinger Website Builder',
  'Google Sites',
  'Blogger',
])
const MODERN = new Set(['Webflow', 'Framer', 'Next.js', 'Astro'])
const FREE_SUBDOMAINS = /\.(wixsite\.com|godaddysites\.com|webnode\.(mx|es|com)|jimdofree\.com|weebly\.com|blogspot\.com|zyrosite\.com|wordpress\.com|business\.site)$/i

const HACKED = /hacked by|hackeado|ha sido hackead|has been hacked|defaced by|site has been compromised/i
const WP_CRITICAL = /ha habido un error cr[ií]tico en esta web|there has been a critical error on (this|your) website/i
const DB_ERROR = /error establishing a database connection|error al establecer una conexi[oó]n con la base de datos/i
const PARKED =
  /domain (name )?is for sale|buy this domain|this domain may be for sale|dominio (est[aá] )?(a la )?venta|comprar este dominio|parked (free|domain)|domain parking|sedoparking|parkingcrew|bodis\.com|afternic|hugedomains|\bdan\.com|this domain has expired|domain has expired|el dominio ha (expirado|caducado)|future home of something quite cool|this web page is parked/i
const DEFAULT_PAGE =
  /<title>\s*index of \/|apache2 (ubuntu|debian) default page|welcome to nginx!|<title>\s*it works!?\s*<\/title>|default web site page|web server'?s default page|<title>\s*iis windows server|cpanel, inc\. - default/i
/** Bienvenida del proveedor de hosting o del registrador: el dominio existe, el sitio no. */
const HOSTING_PLACEHOLDER =
  /akky hosting|sigue adelante con akky|this domain (has been|was) registered (with|at|by)|este dominio (ha sido|fue) registrado|dominio registrado (con|en) |your hosting( account)? is (ready|active|set up)|tu hosting (ya )?est[aá] (listo|activo)|there'?s nothing here,? yet|aqu[ií] no hay nada (todav[ií]a|a[uú]n)/i
const CONSTRUCTION =
  /en construcci[oó]n|under construction|coming soon|pr[oó]ximamente|sitio en mantenimiento|estamos en mantenimiento|modo mantenimiento|maintenance mode|volveremos pronto|we'?ll be back soon|be right back|estamos trabajando en (nuestro|el) (nuevo )?sitio/i

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Minúsculas y sin acentos, para comparar nombres escritos de distintas formas. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Palabras del giro que comparten casi todos los negocios y no identifican a ninguno. */
const GENERIC_WORDS = new Set(
  'abogados abogado abogada abogadas despacho despachos juridico juridicos juridica juridicas asociados asociadas asociado consultores consultoria consultora legal legales firma bufete grupo servicios servicio derecho mexico ciudad cdmx corporativo corporativa oficina oficinas notaria contadores contador contable clinica dental consultorio centro estudio estudios empresa empresas especialistas especialista profesional profesionales internacional nacional litigio laboral familiar penal civil mercantil fiscal'.split(
    ' '
  )
)

function distinctiveTokens(name: string | null | undefined): string[] {
  if (!name) return []
  return fold(name)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !GENERIC_WORDS.has(word))
}

function titleOf(html: string): string | null {
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title = raw ? decodeEntities(raw).slice(0, 200) : ''
  return title || null
}

function metaContent(html: string, name: string): string | null {
  const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i'))?.[0]
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() || null
}

/** Valores de <meta name="generator">. Los plugins agregan los suyos, por eso se leen todos. */
const GENERATORS: [string, RegExp][] = [
  ['Wix', /wix\.com/i],
  ['Joomla', /joomla/i],
  ['Drupal', /drupal/i],
  ['GoDaddy Website Builder', /godaddy|starfield/i],
  ['Webnode', /webnode/i],
  ['Jimdo', /jimdo/i],
  ['Weebly', /weebly/i],
  ['Squarespace', /squarespace/i],
  ['Blogger', /^blogger/i],
  ['Hostinger Website Builder', /hostinger|zyro/i],
  ['Webflow', /webflow/i],
  ['Framer', /^framer/i],
  ['Astro', /^astro/i],
  ['Adobe Muse', /adobe muse/i],
  ['Microsoft FrontPage', /frontpage/i],
  ['Dreamweaver', /dreamweaver/i],
]

function detectCms(html: string): { name: string | null; version: string | null } {
  const generators = [...html.matchAll(/<meta[^>]+name=["']generator["'][^>]*>/gi)]
    .map((m) => m[0].match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? '')
    .filter(Boolean)

  for (const generator of generators) {
    const wp = generator.match(/^wordpress\s*([\d.]+)?/i)
    if (wp) return { name: 'WordPress', version: wp[1] ?? null }
  }
  for (const generator of generators) {
    const known = GENERATORS.find(([, pattern]) => pattern.test(generator))
    if (known) return { name: known[0], version: null }
  }
  for (const [name, pattern] of CMS_PATTERNS) {
    if (pattern.test(html)) return { name, version: null }
  }
  return { name: null, version: null }
}

function latestCopyrightYear(text: string): number | null {
  let latest: number | null = null
  const pattern = /(?:©|\(c\)|copyright|derechos reservados)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi
  for (const match of text.matchAll(pattern)) {
    const year = Number(match[2] ?? match[1])
    if (latest === null || year > latest) latest = year
  }
  return latest
}

function failureAnalysis(failure: FetchFailure): SiteAnalysis {
  // Si el sitio alcanzó a responder con una redirección y lo que falló fue el destino por
  // tiempo o conexión, puede ser un tropiezo pasajero: lo decide la revisión visual. Un
  // destino que ni siquiera existe en el DNS sí es definitivo.
  const afterRedirect = failure.message.startsWith('Redirige a ')
  const transientAfterRedirect = afterRedirect && failure.kind !== 'dns'
  const unverified = failure.kind === 'blocked' || failure.kind === 'network' || transientAfterRedirect
  const label = transientAfterRedirect
    ? `${failure.message.replace(', que no abre', '')}, que no respondió a tiempo`
    : afterRedirect
      ? failure.message
    : failure.kind === 'dns'
      ? 'El dominio no existe o dejó de resolver'
      : failure.kind === 'timeout'
        ? 'El sitio no responde (tarda demasiado)'
        : failure.kind === 'refused'
          ? 'El servidor rechaza la conexión'
          : failure.kind === 'tls'
            ? 'Certificado de seguridad inválido y el sitio no abre'
            : failure.kind === 'redirects'
              ? 'Se queda redirigiendo sin abrir'
              : `No se pudo revisar automáticamente (${failure.message})`

  return {
    status: unverified ? 'unverified' : 'dead',
    httpStatus: null,
    finalUrl: null,
    title: null,
    cms: null,
    issues: [{ code: unverified ? 'unreachable' : 'dead', label, weight: unverified ? 0 : 100 }],
    score: unverified ? 0 : 100,
    whatsapp: [],
  }
}

export interface AnalyzeOptions {
  now?: Date
  /** Nombre del negocio en Maps: si la página nunca lo menciona, el dominio quizá ya es de otro. */
  businessName?: string | null
}

export function analyzeSite(result: FetchedPage | FetchFailure, options: AnalyzeOptions = {}): SiteAnalysis {
  if (result instanceof FetchFailure) return failureAnalysis(result)
  const now = options.now ?? new Date()

  const page = result
  const html = page.body
  const text = visibleText(html)
  const lower = html.toLowerCase()
  const issues: SiteIssue[] = []
  const add = (code: string, label: string, weight: number) => issues.push({ code, label, weight })
  let status: SiteStatus = 'ok'

  const finalHost = (() => {
    try {
      return new URL(page.finalUrl).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()
  const requestedHost = (() => {
    try {
      return new URL(page.requestedUrl).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      return ''
    }
  })()
  const shortPage = text.length < 1500
  const title = titleOf(html)
  const cms = detectCms(html)
  const whatsapp = extractWhatsappNumbers(html)

  // Lo que deja al sitio inservible va primero y decide el estado.
  if (classifyWebsite(page.finalUrl).kind === 'social') {
    status = 'social'
    add('redirect_social', 'Su dominio redirige a una red social', 60)
  } else if (HACKED.test(text) || (title && HACKED.test(title))) {
    status = 'hacked'
    add('hacked', 'Parece hackeado o muestra contenido ajeno', 95)
  } else if (WP_CRITICAL.test(text)) {
    status = 'broken'
    add('wp_critical', 'Muestra un error crítico de WordPress', 95)
  } else if (DB_ERROR.test(text)) {
    status = 'broken'
    add('db_error', 'Muestra un error de conexión con la base de datos', 95)
  } else if (page.status === 403 || page.status === 429 || (page.status === 503 && /cloudflare|captcha|challenge/i.test(lower))) {
    // Bloqueos anti-robots: el sitio puede estar bien. Lo decide la revisión visual.
    status = 'unverified'
    add('bot_blocked', `No se pudo revisar automáticamente (responde ${page.status})`, 0)
  } else if (page.status >= 400) {
    status = 'broken'
    add('http_error', `Responde con error ${page.status}`, 90)
  } else if (PARKED.test(text) && shortPage) {
    status = 'parked'
    add('parked', 'Dominio estacionado, en venta o vencido', 90)
  } else if (HOSTING_PLACEHOLDER.test(`${title ?? ''} ${text}`) && shortPage) {
    status = 'parked'
    add('hosting_placeholder', 'Muestra la página de bienvenida de su proveedor de hosting', 90)
  } else if (DEFAULT_PAGE.test(html) && shortPage) {
    status = 'parked'
    add('default_page', 'Muestra la página por defecto del servidor', 85)
  } else if ((shortPage && CONSTRUCTION.test(text)) || (title && CONSTRUCTION.test(title))) {
    status = 'construction'
    add('construction', 'Sitio en construcción o en mantenimiento', 85)
  }

  if (status === 'unverified') {
    return { status, httpStatus: page.status, finalUrl: page.finalUrl, title, cms: cms.name, issues, score: 0, whatsapp }
  }

  if (status === 'ok' && finalHost && requestedHost && !finalHost.endsWith(requestedHost)) {
    add('redirect_other', `Redirige a otro dominio (${finalHost.replace(/^www\./, '')})`, 10)
  }

  if (page.tlsError) add('ssl_invalid', 'Certificado de seguridad inválido o vencido', 25)
  else if (page.finalUrl.startsWith('http:')) add('no_https', 'Sin HTTPS: el navegador lo marca como no seguro', 20)

  const hasViewport = /<meta[^>]+name=["']?viewport/i.test(html)
  const jsOnly = text.length < 200 && /<div[^>]+id=["'](root|app|__next|___gatsby)["']/i.test(html)

  if (status === 'ok') {
    if (!hasViewport && !jsOnly) add('no_viewport', 'No se adapta a celular', 35)
    if (/href=["'][^"']*\/(movil|mobile)\/[^"']*["']|location(\.href)?\s*=\s*["'][^"']*\/(movil|mobile)\//i.test(html)) {
      add('separate_mobile', 'Tiene una versión aparte para celular', 25)
    }

    const legacy: string[] = []
    if (/<frameset/i.test(html)) legacy.push('frames')
    if (/\.swf["'?]|application\/x-shockwave-flash/i.test(html)) legacy.push('Flash')
    if (/<marquee/i.test(html)) legacy.push('marquesinas')
    if ((html.match(/<font[\s>]/gi) ?? []).length >= 5) legacy.push('etiquetas <font>')
    if (cms.name === 'Adobe Muse' || /frontpage|dreamweaver/i.test(cms.name ?? '')) legacy.push(cms.name!)
    if (legacy.length) add('legacy_tech', `Tecnología antigua (${legacy.slice(0, 2).join(', ')})`, 30)

    if (jsOnly) add('js_only', 'El contenido se genera con JavaScript (lo confirma la revisión visual)', 0)
    else if (text.length < 400) add('thin_content', 'Casi no tiene contenido', 30)

    const tokens = distinctiveTokens(options.businessName)
    if (!jsOnly && text.length >= 400 && tokens.length > 0) {
      const haystack = fold(`${title ?? ''} ${text}`)
      if (!tokens.some((token) => haystack.includes(token))) {
        add('name_mismatch', 'La página no menciona el nombre del negocio (¿el dominio ya es de otro?)', 40)
      }
    }

    const hasContact = /href=["']?(tel:|mailto:)/i.test(html) || whatsapp.length > 0 || /wa\.me\/message\//i.test(html)
    if (!hasContact) add('no_contact', 'Sin botones de contacto directo (teléfono, correo o WhatsApp)', 10)
    else if (whatsapp.length === 0 && !/wa\.me|whatsapp/i.test(lower)) add('no_whatsapp', 'Sin botón de WhatsApp', 5)
  }

  if (cms.name && FREE_SUBDOMAINS.test(finalHost)) {
    add('free_builder', `Hecho con constructor gratuito (${cms.name}) y sin dominio propio`, 25)
  } else if (cms.name && BUILDERS.has(cms.name)) {
    add('site_builder', `Hecho con ${cms.name}`, 5)
  }
  if (cms.name === 'WordPress' && cms.version && Number(cms.version.split('.')[0]) < 5) {
    add('old_cms', `WordPress ${cms.version} (muy desactualizado)`, 15)
  }

  const year = latestCopyrightYear(text)
  const age = year ? now.getFullYear() - year : 0
  if (year && age >= 2) add('old_copyright', `El pie de página dice © ${year}`, age >= 5 ? 25 : age >= 3 ? 15 : 10)

  if (!title) add('no_title', 'Sin título de página', 10)
  if (status === 'ok' && !metaContent(html, 'description')) add('no_description', 'Sin descripción para Google', 5)
  if (page.elapsedMs > 8000) add('slow', `Tarda en responder (${Math.round(page.elapsedMs / 1000)} s)`, 10)

  if (status === 'ok' && cms.name && MODERN.has(cms.name) && hasViewport) {
    add('modern_stack', `Sitio moderno (${cms.name})`, -20)
  }

  const score = Math.max(0, Math.min(100, issues.reduce((sum, issue) => sum + issue.weight, 0)))
  issues.sort((a, b) => b.weight - a.weight)

  return { status, httpStatus: page.status, finalUrl: page.finalUrl, title, cms: cms.name, issues, score, whatsapp }
}

/** Etapa del embudo que corresponde a una revisión. */
export function stageForAnalysis(
  analysis: Pick<SiteAnalysis, 'status' | 'score'>
): 'candidate' | 'site_ok' | 'unverified' {
  if (analysis.status === 'unverified') return 'unverified'
  if (analysis.status !== 'ok' || analysis.score >= CANDIDATE_SCORE) return 'candidate'
  return 'site_ok'
}

import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import zlib from 'node:zlib'

/**
 * Descarga la home de un lead para revisarla.
 *
 * Las URLs vienen de Google Maps, es decir, de terceros: el servidor no puede fiarse de
 * ellas. Por eso cada conexión (incluida cada redirección) valida que la IP resuelta sea
 * pública, y así una URL no puede apuntar a servicios internos del VPS (la base de datos,
 * el panel de Dokploy, metadatos de la nube). La validación va en el `lookup` del socket,
 * no antes de la petición, para que un DNS que cambia de respuesta no la esquive.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 HemeronProspector/1.0'
const TOTAL_TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 6
/** Bastan para analizar una home; más es casi siempre video o un volcado roto. */
const MAX_BODY_BYTES = 2_500_000
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443'])

const TLS_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'EPROTO',
])

export type FetchFailureKind = 'dns' | 'timeout' | 'refused' | 'tls' | 'blocked' | 'redirects' | 'network'

export class FetchFailure extends Error {
  constructor(
    readonly kind: FetchFailureKind,
    message: string,
    readonly code?: string
  ) {
    super(message)
    this.name = 'FetchFailure'
  }
}

export interface FetchedPage {
  requestedUrl: string
  finalUrl: string
  status: number
  contentType: string
  body: string
  redirects: string[]
  elapsedMs: number
  /** El certificado no era válido y la página se leyó sin verificarlo. */
  tlsError: string | null
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
}

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
]

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) {
    const value = ipv4ToInt(address)
    return !BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      return (value & mask) === (ipv4ToInt(base) & mask)
    })
  }
  if (family === 6) {
    const ip = address.toLowerCase()
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPublicAddress(mapped[1])
    const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16)
      const lo = parseInt(mappedHex[2], 16)
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
    }
    if (ip === '::' || ip === '::1') return false
    // fc00::/7 (privadas), fe80::/10 (enlace local), ff00::/8 (multicast)
    return !/^(f[cd]|fe[89ab]|ff)/.test(ip)
  }
  return false
}

const guardedLookup = ((
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '')
    const list = addresses as dns.LookupAddress[]
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      const blocked = Object.assign(new Error(`${hostname} resuelve a una dirección no pública`), { code: 'EBLOCKED' })
      return callback(blocked, '')
    }
    if (options.all) return callback(null, list)
    return callback(null, list[0].address, list[0].family)
  })
}) as unknown as net.LookupFunction

function assertFetchable(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchFailure('blocked', `Protocolo no permitido: ${url.protocol}`)
  }
  if (!ALLOWED_PORTS.has(url.port)) throw new FetchFailure('blocked', `Puerto no permitido: ${url.port}`)
  const literal = url.hostname.replace(/^\[|\]$/g, '')
  // Con una IP literal el socket no consulta el DNS, así que el lookup no la vería.
  if (net.isIP(literal) && !isPublicAddress(literal)) {
    throw new FetchFailure('blocked', 'La URL apunta a una dirección no pública')
  }
}

interface RawResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: Buffer
}

function decompress(body: Buffer, encoding: string | undefined): Buffer {
  const value = (encoding ?? '').toLowerCase()
  const opts = { maxOutputLength: MAX_BODY_BYTES * 4 }
  try {
    if (value.includes('br')) return zlib.brotliDecompressSync(body, opts)
    if (value.includes('gzip')) return zlib.gunzipSync(body, { ...opts, finishFlush: zlib.constants.Z_SYNC_FLUSH })
    if (value.includes('deflate')) return zlib.inflateSync(body, opts)
  } catch {
    // Un cuerpo truncado por el límite de tamaño no descomprime completo; con lo que haya basta.
  }
  return body
}

function requestOnce(url: URL, insecure: boolean, deadline: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return reject(new FetchFailure('timeout', 'Se agotó el tiempo de espera'))

    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request(url, {
      method: 'GET',
      agent: false,
      lookup: guardedLookup,
      rejectUnauthorized: !insecure,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    })

    const timer = setTimeout(() => req.destroy(new FetchFailure('timeout', 'Se agotó el tiempo de espera')), remaining)

    req.on('response', (res) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BODY_BYTES) {
          chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - MAX_BODY_BYTES))))
          res.destroy()
          return
        }
        chunks.push(chunk)
      })
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const raw = Buffer.concat(chunks)
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: decompress(raw, res.headers['content-encoding']) })
      }
      res.on('end', finish)
      res.on('close', finish)
      res.on('error', finish)
    })

    req.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(error)
    })
    req.end()
  })
}

function classifyError(error: unknown): FetchFailure {
  if (error instanceof FetchFailure) return error
  const err = error as NodeJS.ErrnoException
  const code = err?.code ?? ''
  if (code === 'EBLOCKED') return new FetchFailure('blocked', err.message, code)
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENODATA') {
    return new FetchFailure('dns', 'El dominio no existe o no resuelve', code)
  }
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return new FetchFailure('refused', 'El servidor rechazó la conexión', code)
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return new FetchFailure('timeout', 'Se agotó el tiempo de espera', code)
  if (TLS_ERROR_CODES.has(code) || code.startsWith('ERR_SSL') || code.startsWith('ERR_TLS')) {
    return new FetchFailure('tls', 'Certificado de seguridad inválido', code)
  }
  return new FetchFailure('network', err?.message || 'Error de red', code || undefined)
}

function charsetOf(contentType: string, body: Buffer): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1]
  if (fromHeader) return fromHeader.toLowerCase()
  const head = body.subarray(0, 4096).toString('latin1')
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
  return fromMeta?.toLowerCase() ?? 'utf-8'
}

function decodeBody(body: Buffer, contentType: string): string {
  try {
    return new TextDecoder(charsetOf(contentType, body)).decode(body)
  } catch {
    return new TextDecoder('utf-8').decode(body)
  }
}

/** Redirección por <meta http-equiv="refresh">, muy común en sitios viejos. */
function metaRefreshTarget(html: string, base: URL): URL | null {
  const tag = html.slice(0, 20000).match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/i)?.[0]
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1]
  const match = content?.match(/^\s*(\d+)\s*;\s*url\s*=\s*['"]?([^'"]+)/i)
  if (!match || Number(match[1]) > 5) return null
  try {
    return new URL(match[2].trim(), base)
  } catch {
    return null
  }
}

export async function fetchSite(rawUrl: string): Promise<FetchedPage> {
  const started = Date.now()
  const deadline = started + TOTAL_TIMEOUT_MS
  const redirects: string[] = []
  let tlsError: string | null = null
  /** Si el servidor nos mandó a otra URL; los reintentos con www o http no cuentan. */
  let redirected = false
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new FetchFailure('blocked', 'URL inválida')
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchable(url)

    let res: RawResponse
    try {
      res = await requestOnce(url, false, deadline)
    } catch (error) {
      const failure = classifyError(error)
      if (failure.kind === 'tls') {
        // Leemos la página igual: un certificado vencido es justo un hallazgo para el rediseño.
        tlsError = failure.code ?? 'TLS'
        try {
          res = await requestOnce(url, true, deadline)
        } catch (retryError) {
          throw classifyError(retryError)
        }
      } else if (failure.kind === 'refused' && url.protocol === 'https:' && hop === 0) {
        // Muchos sitios viejos solo responden por http.
        url = new URL(url.toString().replace(/^https:/, 'http:'))
        redirects.push(url.toString())
        continue
      } else if (failure.kind === 'dns' && hop === 0 && !url.hostname.startsWith('www.')) {
        // Maps suele guardar el dominio pelón aunque solo tenga DNS el "www.".
        url = new URL(url.toString())
        url.hostname = `www.${url.hostname}`
        redirects.push(url.toString())
        continue
      } else {
        if (redirected && (failure.kind === 'dns' || failure.kind === 'refused' || failure.kind === 'timeout')) {
          throw new FetchFailure(failure.kind, `Redirige a ${url.hostname}, que no abre`, failure.code)
        }
        throw failure
      }
    }

    const location = res.headers.location
    if (res.status >= 300 && res.status < 400 && location) {
      redirected = true
      url = new URL(location, url)
      redirects.push(url.toString())
      continue
    }

    const contentType = String(res.headers['content-type'] ?? '')
    const isHtml = !contentType || /html|xml/i.test(contentType)
    const body = isHtml ? decodeBody(res.body, contentType) : ''

    const refresh = res.status < 300 && body ? metaRefreshTarget(body, url) : null
    if (refresh && refresh.toString() !== url.toString() && hop < MAX_REDIRECTS) {
      redirected = true
      url = refresh
      redirects.push(url.toString())
      continue
    }

    return {
      requestedUrl: rawUrl,
      finalUrl: url.toString(),
      status: res.status,
      contentType,
      body,
      redirects,
      elapsedMs: Date.now() - started,
      tlsError,
    }
  }

  throw new FetchFailure('redirects', 'Demasiadas redirecciones')
}

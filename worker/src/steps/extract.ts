import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium, type BrowserContext, type Page } from 'playwright-core'
import { config } from '../config.js'

/**
 * Extracción del sitio, igual que lista-2/_tools/extract-all.mjs pero para un solo negocio:
 * capturas a 1440, marca y contenido de la home (con el mismo inpage.js), subpáginas útiles,
 * enlaces de contacto y los recursos (logos candidatos, og, favicons, imágenes grandes).
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const WA_RE = /(?:https?:\/\/)?(?:wa\.me\/[^\s"'<>)]+|api\.whatsapp\.com\/send[^\s"'<>)]+|wa\.link\/[^\s"'<>)]+|web\.whatsapp\.com\/send[^\s"'<>)]+|whatsapp:\/\/send[^\s"'<>)]+)/gi
const TEL_RE = /tel:([+\d\s().-]{7,})/gi
const MAIL_RE = /mailto:([^"'?\s<>]+)/gi
const WANTED = /contact|nosotros|quienes|somos|empresa|servicio|area|practica|equipo|especial|aviso|privacidad|about|team|services|menu|carta|productos|tratamientos|clases|precios|tarifas|blog|clientes|galeria/i

function extFrom(url: string, ct?: string) {
  const m = (url.split('?')[0].match(/\.(svg|png|jpe?g|webp|gif|ico|avif)$/i) || [])[1]
  if (m) return m.toLowerCase().replace('jpeg', 'jpg')
  if (ct?.includes('svg')) return 'svg'
  if (ct?.includes('png')) return 'png'
  if (ct?.includes('webp')) return 'webp'
  if (ct?.includes('jpeg')) return 'jpg'
  if (ct?.includes('icon')) return 'ico'
  return 'bin'
}

async function download(ctx: BrowserContext, url: string, file: string, maxBytes = 4_000_000) {
  try {
    const res = await ctx.request.get(url, { timeout: 15000, headers: { 'User-Agent': UA } })
    if (!res.ok()) return null
    const body = await res.body()
    if (body.length > maxBytes || body.length < 200) return null
    const out = `${file}.${extFrom(url, res.headers()['content-type'])}`
    fs.writeFileSync(out, body)
    return { file: path.basename(out), bytes: body.length, url }
  } catch {
    return null
  }
}

async function gather(page: Page) {
  const html = await page.content()
  const uniq = (a: string[]) => [...new Set(a.map((s) => s.replace(/&amp;/g, '&')))]
  return {
    wa: uniq(html.match(WA_RE) || []),
    tel: uniq([...html.matchAll(TEL_RE)].map((m) => m[1].trim())),
    mail: uniq([...html.matchAll(MAIL_RE)].map((m) => m[1].trim())),
    ldjson: [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim().slice(0, 4000)),
  }
}

export interface ExtractResult {
  status: 'ok' | 'error' | 'skipped'
  http?: number | null
  finalUrl?: string
  error?: string
  downloads: number
}

export async function extractSite(url: string | null, dir: string): Promise<ExtractResult> {
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true })
  if (!url) {
    fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify({ status: 'skipped', reason: 'Sin sitio propio' }, null, 1))
    return { status: 'skipped', downloads: 0 }
  }

  const { inpage } = (await import(pathToFileURL(path.join(config.toolsDir, 'inpage.js')).href)) as { inpage: () => unknown }
  // El worker maneja las señales: un Ctrl+C no debe cerrar el navegador a media extracción.
  const browser = await chromium.launch({ channel: 'chrome', headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true, locale: 'es-MX' })
  const page = await ctx.newPage()
  const result: Record<string, unknown> = { url, status: 'pending' }
  const downloads: Record<string, unknown>[] = []
  try {
    let resp = null
    try {
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 })
    } catch {
      const alt = url.startsWith('https') ? url.replace('https:', 'http:') : url.replace('http:', 'https:')
      resp = await page.goto(alt, { waitUntil: 'domcontentloaded', timeout: 35000 })
    }
    result.http = resp?.status() ?? null
    result.finalUrl = page.url()
    await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {})
    // Avisos de cookies y ventanas emergentes, sin insistir.
    await page
      .evaluate(() => {
        document.querySelectorAll('button, a').forEach((b) => {
          const t = ((b as HTMLElement).innerText || '').trim().toLowerCase()
          if (/^(aceptar|accept|entendido|ok|cerrar|close|acepto)/.test(t) && b.getBoundingClientRect().width > 0) {
            try {
              ;(b as HTMLElement).click()
            } catch {}
          }
        })
      })
      .catch(() => {})
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(dir, 'original-hero.jpg'), type: 'jpeg', quality: 70 }).catch(() => {})
    const data = (await page.evaluate(inpage)) as Record<string, unknown> & { logos?: { src?: string; tag?: string; box?: unknown; alt?: string }[]; ogImage?: string; favicon?: string[]; images?: string[] }
    await page
      .evaluate(async () => {
        const H = Math.min(document.body.scrollHeight, 14000)
        for (let y = 0; y < H; y += 700) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        window.scrollTo(0, 0)
      })
      .catch(() => {})
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(dir, 'original-full.jpg'), type: 'jpeg', quality: 45, fullPage: true, timeout: 20000 }).catch(() => {})
    const home = await gather(page)
    fs.writeFileSync(path.join(dir, 'home.txt'), await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 20000)).catch(() => ''))

    const host = new URL(page.url()).hostname.replace(/^www\./, '')
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => ({ h: (a as HTMLAnchorElement).href, t: ((a as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40) }))
    )
    const seen = new Set([page.url().split('#')[0]])
    const subs: { url: string; label: string }[] = []
    for (const l of links) {
      try {
        const u = new URL(l.h)
        if (u.hostname.replace(/^www\./, '') !== host) continue
        u.hash = ''
        if (seen.has(u.href) || /\.(pdf|jpg|png|zip|docx?)$/i.test(u.pathname)) continue
        if (!WANTED.test(`${u.pathname} ${l.t}`)) continue
        seen.add(u.href)
        subs.push({ url: u.href, label: l.t })
      } catch {}
    }
    const pages = []
    const extra = { wa: [...home.wa], tel: [...home.tel], mail: [...home.mail], ldjson: [...home.ldjson] }
    for (const s of subs.slice(0, 8)) {
      try {
        await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 20000 })
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
        const g = await gather(page)
        extra.wa.push(...g.wa)
        extra.tel.push(...g.tel)
        extra.mail.push(...g.mail)
        extra.ldjson.push(...g.ldjson)
        const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 7000))
        pages.push({ url: s.url, label: s.label, title: await page.title(), text })
      } catch (e) {
        pages.push({ url: s.url, label: s.label, error: String((e as Error).message).slice(0, 80) })
      }
    }
    for (const k of Object.keys(extra) as (keyof typeof extra)[]) extra[k] = [...new Set(extra[k])]

    let i = 0
    for (const lg of data.logos ?? []) {
      if (lg.src && !lg.src.startsWith('data:')) {
        const d = await download(ctx, lg.src, path.join(dir, `assets/logo-cand-${++i}`))
        if (d) downloads.push({ ...d, kind: 'logo-candidate', box: lg.box, alt: lg.alt })
      }
      if (i >= 4) break
    }
    try {
      await page.goto(String(result.finalUrl), { waitUntil: 'domcontentloaded', timeout: 25000 })
      const svgs = await page.evaluate(() => {
        const out: string[] = []
        document.querySelectorAll('header svg, nav svg, a[class*=logo] svg, [class*=logo] svg, [id*=logo] svg').forEach((s) => {
          const r = s.getBoundingClientRect()
          if (r.width > 40 && r.height > 14 && r.top < 500 && s.outerHTML.length < 60000) out.push(s.outerHTML)
        })
        return [...new Set(out)].slice(0, 2)
      })
      svgs.forEach((s, k) => {
        const file = path.join(dir, `assets/logo-inline-${k + 1}.svg`)
        fs.writeFileSync(file, s.includes('xmlns') ? s : s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))
        downloads.push({ file: path.basename(file), kind: 'logo-inline-svg', bytes: s.length })
      })
    } catch {}
    if (data.ogImage) {
      const d = await download(ctx, data.ogImage, path.join(dir, 'assets/og'))
      if (d) downloads.push({ ...d, kind: 'og' })
    }
    for (const fav of data.favicon ?? []) {
      const d = await download(ctx, fav, path.join(dir, `assets/favicon-${downloads.filter((x) => x.kind === 'favicon').length}`))
      if (d) downloads.push({ ...d, kind: 'favicon' })
    }
    let n = 0
    for (const im of data.images ?? []) {
      const u = im.split(' [')[0]
      if (!/^https?:/.test(u) || /\.(svg|gif)(\?|$)/i.test(u)) continue
      const d = await download(ctx, u, path.join(dir, `assets/img-${String(++n).padStart(2, '0')}`))
      if (d) downloads.push({ ...d, kind: 'image', info: im.slice(u.length) })
      if (n >= 8) break
    }
    Object.assign(result, { status: 'ok', extractedAt: new Date().toISOString(), data, extra, subpages: subs.length, downloads })
    fs.writeFileSync(path.join(dir, 'pages.json'), JSON.stringify(pages, null, 1))
  } catch (e) {
    result.status = 'error'
    result.error = String((e as Error).message).split('\n')[0].slice(0, 200)
  } finally {
    await ctx.close().catch(() => {})
    await browser.close().catch(() => {})
  }
  fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify(result, null, 1))
  return {
    status: result.status === 'ok' ? 'ok' : 'error',
    http: result.http as number | null,
    finalUrl: result.finalUrl as string | undefined,
    error: result.error as string | undefined,
    downloads: downloads.length,
  }
}

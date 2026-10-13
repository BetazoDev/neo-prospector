import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import sharp from 'sharp'
import type { ClaimedLead } from '../api.js'
import { config } from '../config.js'
import { run, start, type RunError } from '../proc.js'

/**
 * Publicación en el sitio de demos (repo BetazoDev/demos, Dokploy despliega cada push a main).
 *
 * Una publicación a la vez: todas tocan el mismo repositorio. Antes de subir nada se compila
 * el proyecto Astro completo, porque una demo rota tumbaría el despliegue de todas las demás;
 * si la compilación falla, se deshace todo lo copiado. Solo se agregan al commit los archivos
 * de esta demo y el registro del directorio, nunca cambios ajenos.
 */

export class PublishError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
    /** Salida completa de una compilación fallida, para que el siguiente intento la corrija. */
    readonly buildLog?: string
  ) {
    super(message)
    this.name = 'PublishError'
  }
}

/** El repositorio tiene cambios de otra sesión: no es culpa de la demo, se espera y se reintenta. */
export class RepoBusyError extends PublishError {
  constructor(message: string, retryAfterMs: number) {
    super(message, true, retryAfterMs)
    this.name = 'RepoBusyError'
  }
}

let chain: Promise<unknown> = Promise.resolve()
let writing: Promise<unknown> | null = null
/** Mientras se copia, compila y sube una demo; el worker no debe apagarse a la mitad. */
export function publishWriting(): Promise<unknown> | null {
  return writing
}

/** Serializa las publicaciones aunque haya varias demos construyéndose en paralelo. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn)
  chain = next.catch(() => undefined)
  return next
}

const P = () => config.portafolioDir
const git = (...args: string[]) => run('git', ['-C', P(), ...args], { timeout: 180_000 })

const SITES3 = 'src/data/sites3.ts'
const START = '/* sites3 */'
const END = '/* /sites3 */'

interface Site3 {
  slug: string
  name: string
  url: string
  domain: string
  category: string
  leadId: number
  publishedAt: string
}

/**
 * La primera vez agrega al sitio de demos su tercera lista: el registro de las demos del
 * Prospector, sus rutas y su pestaña en el directorio. Comprueba cada anclaje y se detiene si
 * los archivos cambiaron, en vez de parchear a ciegas.
 */
function ensureDirectoryIntegration(): string[] {
  const touched: string[] = []
  const registry = path.join(P(), SITES3)
  if (!fs.existsSync(registry)) {
    fs.writeFileSync(
      registry,
      `// Demos del Prospector de Hemeron (carpeta ../astro). Las registra el worker de la Mac al publicar; no editar a mano.
export type Site3 = { slug: string; name: string; url: string; domain: string; category: string; leadId: number; publishedAt: string };

export const SITES3: Site3[] = ${START} [] ${END};
`
    )
    touched.push(SITES3)
  }

  const nextConfig = path.join(P(), 'next.config.ts')
  let nc = fs.readFileSync(nextConfig, 'utf8')
  if (!nc.includes('SITES3')) {
    const importAnchor = 'import { SITES2 } from "./src/data/sites2";'
    const rewriteAnchor = 'beforeFiles: SITES2.flatMap('
    if (!nc.includes(importAnchor) || !nc.includes(rewriteAnchor)) throw new PublishError('next.config.ts del sitio de demos cambió: no se pudo agregar la lista del Prospector', false)
    nc = nc.replace(importAnchor, `${importAnchor}\nimport { SITES3 } from "./src/data/sites3";`).replace(rewriteAnchor, 'beforeFiles: [...SITES2, ...SITES3].flatMap(')
    fs.writeFileSync(nextConfig, nc)
    touched.push('next.config.ts')
  }

  const page = path.join(P(), 'src/app/page.tsx')
  let pg = fs.readFileSync(page, 'utf8')
  if (!pg.includes('SITES3')) {
    const importAnchor = 'import { SITES2 } from "@/data/sites2";'
    const listsAnchor = 'const LISTS: List[] = ['
    const list2Anchor = '...(list2.length ? [{ id: "2", label: "Lista 2", stack: "Astro", entries: list2 }] : []),'
    if (!pg.includes(importAnchor) || !pg.includes(listsAnchor) || !pg.includes(list2Anchor)) {
      throw new PublishError('src/app/page.tsx del sitio de demos cambió: no se pudo agregar la pestaña del Prospector', false)
    }
    pg = pg
      .replace(importAnchor, `${importAnchor}\nimport { SITES3 } from "@/data/sites3";`)
      .replace(
        listsAnchor,
        `const list3: Entry[] = SITES3.map((s) => ({
  slug: s.slug,
  name: s.name,
  domain: s.domain,
  thumb: \`/thumbs/p-\${s.slug}.webp\`,
  kindLabel: s.category || null,
  isDespacho: /abogad|despacho|jur[ií]dic|legal/i.test(s.category),
}));
${listsAnchor}`
      )
      .replace(list2Anchor, `${list2Anchor}\n  ...(list3.length ? [{ id: "3", label: "Prospector", stack: "Astro", entries: list3 }] : []),`)
    fs.writeFileSync(page, pg)
    touched.push('src/app/page.tsx')
  }
  return touched
}

function registerSite(entry: Site3) {
  const file = path.join(P(), SITES3)
  const text = fs.readFileSync(file, 'utf8')
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  if (a < 0 || b < 0) throw new PublishError(`${SITES3} no tiene sus marcas de registro`, false)
  const list = JSON.parse(text.slice(a + START.length, b)) as Site3[]
  const next = [...list.filter((s) => s.slug !== entry.slug), entry]
  fs.writeFileSync(file, text.slice(0, a + START.length) + ' ' + JSON.stringify(next, null, 1) + ' ' + text.slice(b))
}

async function waitFor(url: string, timeoutMs: number): Promise<boolean> {
  const stop = Date.now() + timeoutMs
  while (Date.now() < stop) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) })
      if (res.ok && (await res.text()).includes('<title')) return true
    } catch {
      // Todavía no responde.
    }
    await new Promise((r) => setTimeout(r, 15_000))
  }
  return false
}

/** Miniatura del directorio desde la compilación de producción (astro preview), 960x600. */
async function thumbnail(slug: string, port: number) {
  const preview = start('pnpm', ['exec', 'astro', 'preview', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: path.join(P(), 'astro'),
    stdio: 'ignore',
  })
  try {
    if (!(await waitFor(`http://127.0.0.1:${port}/${slug}/`, 60_000))) throw new Error('astro preview no respondió')
    const browser = await chromium.launch({ channel: 'chrome', headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
    try {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' })
      const page = await ctx.newPage()
      await page.goto(`http://127.0.0.1:${port}/${slug}/`, { waitUntil: 'load', timeout: 60_000 })
      await page.addStyleTag({ content: '[data-demo-pill]{display:none!important}' })
      await page.waitForTimeout(3200)
      const shot = await page.screenshot({ type: 'png' })
      await sharp(shot).resize(960, 600, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(path.join(P(), `public/thumbs/p-${slug}.webp`))
    } finally {
      await browser.close()
    }
  } finally {
    // pnpm y astro preview van en su propio grupo: se detiene el grupo entero.
    if (preview.pid) {
      try {
        process.kill(-preview.pid, 'SIGTERM')
      } catch {
        // Ya terminó.
      }
    }
  }
}

export async function publishSite(
  lead: ClaimedLead,
  slug: string,
  work: string,
  name: string,
  port: number,
  say: (t: string) => Promise<void>
): Promise<{ demoUrl: string; live: boolean }> {
  return exclusive(async () => {
    const write = writeAndPush(lead, slug, work, name, port, say)
    writing = write
    try {
      await write
    } finally {
      writing = null
    }
    const demoUrl = `${config.demosBaseUrl}/${slug}`
    await say('Subida al repositorio; esperando a que Dokploy despliegue')
    const live = await waitFor(demoUrl, 25 * 60_000)
    return { demoUrl, live }
  })
}

async function writeAndPush(lead: ClaimedLead, slug: string, work: string, name: string, port: number, say: (t: string) => Promise<void>) {
  // Solo arrancamos sobre main, limpio y al día: los cambios y commits ajenos no se tocan ni se suben.
  const busy = (why: string) => new RepoBusyError(`El repositorio de demos ${why}; se reintenta en 15 minutos`, 15 * 60_000)
  const { stdout: branch } = await git('rev-parse', '--abbrev-ref', 'HEAD')
  if (branch.trim() !== 'main') throw busy(`está en la rama ${branch.trim()}, no en main`)
  const { stdout: dirty } = await git('status', '--porcelain')
  if (dirty.trim()) throw busy('tiene cambios sin commitear de otra sesión')
  await git('fetch', '-q', 'origin', 'main')
  const { stdout: ahead } = await git('rev-list', '--count', 'origin/main..HEAD')
  if (Number(ahead.trim()) > 0) throw busy('tiene commits locales sin subir')
  await git('merge', '-q', '--ff-only', 'origin/main')

  const sitesDir = `astro/src/sites/${slug}`
  const pagesDir = `astro/src/pages/${slug}`
  const thumb = `public/thumbs/p-${slug}.webp`
  // Deshace solo lo que esta publicación tocó; cualquier otro cambio en el repo se respeta.
  const rollback = async () => {
    fs.rmSync(path.join(P(), sitesDir), { recursive: true, force: true })
    fs.rmSync(path.join(P(), pagesDir), { recursive: true, force: true })
    fs.rmSync(path.join(P(), thumb), { force: true })
    const tracked = await git('ls-files', '--', SITES3).then((r) => r.stdout.trim().length > 0).catch(() => false)
    if (tracked) await git('checkout', '--', SITES3).catch(() => undefined)
    else fs.rmSync(path.join(P(), SITES3), { force: true })
    await git('checkout', '--', 'next.config.ts', 'src/app/page.tsx').catch(() => undefined)
  }

  let paths: string[] = []
  let committed = false
  try {
    fs.cpSync(path.join(work, 'src/sites', slug), path.join(P(), sitesDir), { recursive: true })
    fs.cpSync(path.join(work, 'src/pages', slug), path.join(P(), pagesDir), { recursive: true })
    const integration = ensureDirectoryIntegration()
    const domain = (lead.domain ?? '').split('/')[0]
    registerSite({
      slug,
      name,
      url: lead.website ?? '',
      domain,
      category: lead.category ?? '',
      leadId: lead.id,
      publishedAt: new Date().toISOString(),
    })

    await say('Compilando el sitio de demos completo antes de publicar')
    try {
      await run('pnpm', ['--dir', path.join(P(), 'astro'), 'build'], { timeout: 25 * 60_000, maxBuffer: 2 * 1024 * 1024 })
    } catch (error) {
      const e = error as Partial<RunError>
      const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.trim() || String(error)
      const lines = out.split('\n').filter(Boolean)
      throw new PublishError(
        `La compilación de Astro falló con esta demo: ${lines.slice(-4).join(' · ').slice(0, 300)}`,
        true,
        undefined,
        lines.slice(-120).join('\n')
      )
    }

    await thumbnail(slug, port).catch(async (e) => say(`Sin miniatura (${String(e.message ?? e).slice(0, 80)}); se publica igual`))

    if (!config.publish) {
      await rollback()
      throw new PublishError('PUBLISH=false: la demo compiló y está lista, pero no se subió', false)
    }

    paths = [sitesDir, pagesDir, SITES3, ...integration.filter((p) => p !== SITES3)]
    if (fs.existsSync(path.join(P(), thumb))) paths.push(thumb)
    await git('add', '--', ...paths)
    // Con rutas explícitas el commit lleva solo esta demo aunque otra sesión haya preparado algo.
    await git(
      'commit',
      '-q',
      '-m',
      `Prospector: demo de ${name}\n\nNegocio ${lead.id} del Prospector (${lead.category ?? 'sin giro'}, ${lead.city ?? 'sin ciudad'}). Investigación y construcción hechas por el worker de la Mac.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`,
      '--',
      ...paths
    )
    committed = true
    try {
      await git('push', '-q', 'origin', 'main')
    } catch {
      await git('pull', '--rebase', '--quiet', 'origin', 'main')
      await git('push', '-q', 'origin', 'main')
    }
  } catch (error) {
    // Un push fallido no debe dejar un commit local ni un rebase a medias que bloqueen la siguiente.
    await git('rebase', '--abort').catch(() => undefined)
    if (committed) {
      await git('reset', '-q', '--soft', 'HEAD~1').catch(() => undefined)
      await git('reset', '-q', '--', ...paths).catch(() => undefined)
    }
    await rollback()
    if (error instanceof PublishError) throw error
    throw new PublishError(`Publicación: ${String((error as Error).message ?? error).slice(0, 300)}`, true)
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { api, type ClaimedJob, type Step } from './api.js'
import { AgentError, AuthError, RateLimitError } from './claude.js'
import { config } from './config.js'
import { jobLogger } from './log.js'
import { slugFor } from './slug.js'
import { auditSite, type Audit } from './steps/audit.js'
import { buildSite, fixBuild, workDirFor, type BuildSummary } from './steps/build.js'
import { extractSite } from './steps/extract.js'
import { publishSite, PublishError, RepoBusyError } from './steps/publish.js'
import { researchBusiness, type ResearchSummary } from './steps/research.js'

export interface JobControl {
  /** El plan llegó a su límite (o Claude perdió la sesión): el worker deja de pedir trabajos hasta esa hora. */
  pause: (until: Date, reason: 'limit' | 'auth') => void
  /** El worker se está apagando y ya devolvió sus trabajos a la cola. */
  stopping: () => boolean
  dryRun: boolean
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

/**
 * Un trabajo completo. Cada paso deja sus archivos en la carpeta del negocio, así que un
 * reintento (por ejemplo tras el límite del plan) retoma desde el último paso terminado en
 * vez de repetir horas de investigación.
 */
export async function runJob(job: ClaimedJob, slot: number, ctl: JobControl): Promise<void> {
  const lead = job.lead
  const slug = job.slug ?? slugFor(lead)
  const dir = path.join(config.demosDir, slug)
  const say = jobLogger(`demo ${job.id} · ${slug}`, dir)

  const event = async (text: string, step?: Step, extra: { audit?: unknown; research?: unknown } = {}) => {
    say(text)
    await api.event(job, { text, step, slug, ...extra }).catch((e) => say(`(no se pudo avisar al prospector: ${e.message})`))
  }
  const progress = (text: string) => void event(text)
  // Los pasos largos pasan muchos minutos sin mensajes: el latido evita que parezcan abandonados.
  const heartbeat = setInterval(() => api.heartbeat(job).catch(() => undefined), 4 * 60_000)

  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'lead.json'), JSON.stringify(lead, null, 1))
    await event(`Empieza en ${config.workerId} (intento ${job.attempts}): ${lead.title}`, 'audit')

    // 1. Extracción del sitio actual.
    const ownSite = lead.siteKind === 'web' && !!lead.website
    let extracted = readJson<{ status: string }>(path.join(dir, 'extract.json'))
    if (!extracted || extracted.status === 'error') {
      // Una auditoría vale para la extracción que miró: si se vuelve a extraer, se vuelve a auditar.
      fs.rmSync(path.join(dir, 'audit.json'), { force: true })
      const ex = await extractSite(ownSite ? lead.website : null, dir)
      extracted = { status: ex.status }
      await event(
        ex.status === 'ok'
          ? `Sitio extraído (HTTP ${ex.http}, ${ex.downloads} recursos)`
          : ex.status === 'skipped'
            ? 'No tiene sitio propio: la propuesta se arma con su ficha de Google y sus redes'
            : `Su sitio no abrió (${ex.error}); se investiga con Wayback y redes`,
        'audit'
      )
    }

    if (ctl.dryRun) {
      // Vuelve a la cola tal cual: la prueba no debe marcar al negocio, gastar un intento ni dejar
      // una auditoría a medias que el intento real reutilizaría.
      await api.finish(job, { outcome: 'released', retryAfterMs: 10 * 60_000, text: `Prueba en seco en ${config.workerId}: extracción hecha; vuelve a la cola` })
      say(`Prueba en seco: extracción en ${dir}; vuelve a la cola en 10 min`)
      return
    }

    // 2. Auditoría visual: decide si vale la pena el resto.
    const checkIssues = (lead.siteIssues ?? []).filter((i) => i.weight > 0).map((i) => i.label)
    let audit = readJson<Audit>(path.join(dir, 'audit.json'))
    if (!audit) {
      if (ownSite && extracted.status === 'ok') {
        audit = await auditSite(lead, dir, progress)
        await event(
          audit.eligible ? `Auditoría: sí amerita demo (${audit.score}/100). ${audit.reasons[0] ?? ''}` : `Auditoría: su sitio está bien. ${audit.summary}`,
          'audit',
          { audit }
        )
      } else {
        // Sin sitio que mirar (caído o inexistente), la revisión automática ya es la razón.
        audit = {
          eligible: true,
          score: lead.siteScore ?? 100,
          reasons: checkIssues.length ? checkIssues : ['No tiene sitio propio'],
          hook: checkIssues[0] ?? 'Hoy solo se le encuentra por su ficha de Google y sus redes',
          summary: ownSite ? 'Su sitio no se pudo abrir para auditarlo.' : 'No tiene sitio propio.',
        }
        fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(audit, null, 1))
      }
    }
    if (!audit.eligible && job.forced) {
      await event('La auditoría dijo que no, pero se pidió de todos modos: sigue', 'audit')
    } else if (!audit.eligible) {
      await api.finish(job, { outcome: 'skipped', text: `La auditoría visual concluyó que su sitio no necesita un rediseño: ${audit.summary}`, audit })
      return
    }

    // 3. Investigación completa (obligatoria antes de construir).
    let research = readJson<ResearchSummary>(path.join(dir, 'research-summary.json'))
    if (!research || !readJson(path.join(dir, 'brand.json'))) {
      await event('Investigando el negocio a fondo: Google, redes, directorios y Wayback', 'research')
      const findings = [...new Set([...checkIssues, ...audit.reasons])].join('; ') || 'sin hallazgos previos'
      research = await researchBusiness(lead, dir, slug, findings, progress)
    } else {
      await event('Retoma la investigación de un intento anterior', 'research')
    }
    await event(
      `Investigación lista: viabilidad ${research.viability}, WhatsApp ${research.whatsapp.number ?? 'no encontrado'} (confianza ${research.whatsapp.confidence})`,
      'research',
      { research }
    )
    if (research.viability === 'dead' || research.viability === 'not-a-business') {
      await api.finish(job, {
        outcome: 'failed',
        retryable: false,
        text: research.viability === 'dead' ? 'Sin información verificable para un sitio honesto (ni sitio, ni archivo, ni perfiles)' : 'No es un negocio al que proponerle un sitio',
      })
      return
    }

    // 4. Construcción en una copia aislada del proyecto Astro.
    const port = config.basePort + slot * 2
    const work = workDirFor(slug)
    let build = readJson<BuildSummary>(path.join(dir, 'build-summary.json'))
    if (!build || build.blocked || !fs.existsSync(path.join(work, 'src/pages', slug, 'index.astro'))) {
      await event('Construyendo el sitio en Astro', 'build')
      build = (await buildSite(lead, dir, slug, port, progress)).summary
    } else {
      await event('Retoma la construcción de un intento anterior', 'build')
    }
    await event(`Sitio construido: ${build.routes.length} páginas · ${build.direction}`, 'build')

    // Un intento anterior no compiló en producción: arreglo puntual antes de volver a publicar.
    const buildErrorFile = path.join(dir, 'publish-error.txt')
    if (fs.existsSync(buildErrorFile)) {
      await event('Corrigiendo el error de compilación del intento anterior', 'build')
      const change = await fixBuild(lead, dir, slug, port, fs.readFileSync(buildErrorFile, 'utf8'), progress)
      fs.rmSync(buildErrorFile, { force: true })
      await event(`Corregido: ${change}`, 'build')
    }

    // 5. Publicación.
    await event('Publicando en el sitio de demos', 'publish')
    let published: { demoUrl: string; live: boolean }
    try {
      published = await publishSite(lead, slug, work, research.name || lead.title, port + 1, (t) => event(t, 'publish'))
    } catch (error) {
      if (error instanceof PublishError && error.buildLog) fs.writeFileSync(buildErrorFile, error.buildLog)
      throw error
    }
    const { demoUrl, live } = published
    await api.finish(job, {
      outcome: 'published',
      demoUrl,
      slug,
      text: live ? `Demo publicada: ${demoUrl}` : `Demo subida; Dokploy tarda más de lo normal en desplegarla: ${demoUrl}`,
    })
    say(`Listo: ${demoUrl}`)
  } catch (error) {
    if (ctl.stopping()) {
      // El worker se apagó a media tarea y ya devolvió el trabajo; no hay nada más que avisar.
    } else if (error instanceof RateLimitError) {
      // No es culpa del negocio: vuelve a la cola sin gastar un intento y retoma donde quedó.
      ctl.pause(error.resetAt, 'limit')
      await api
        .finish(job, { outcome: 'released', retryAfterMs: Math.max(error.resetAt.getTime() - Date.now(), 60_000), text: error.message })
        .catch(() => undefined)
    } else if (error instanceof AuthError) {
      // Sin sesión ningún trabajo avanza: se devuelve sin gastar intento y el worker espera.
      ctl.pause(new Date(Date.now() + 30 * 60_000), 'auth')
      await api.finish(job, { outcome: 'released', retryAfterMs: 5 * 60_000, text: error.message }).catch(() => undefined)
    } else if (error instanceof RepoBusyError) {
      // El repositorio de demos está ocupado por otra sesión: la demo está lista, solo espera turno.
      await api.finish(job, { outcome: 'released', retryAfterMs: error.retryAfterMs, text: error.message }).catch(() => undefined)
    } else if (error instanceof AgentError || error instanceof PublishError) {
      await api
        .finish(job, {
          outcome: 'failed',
          retryable: error.retryable,
          retryAfterMs: error instanceof PublishError ? error.retryAfterMs : undefined,
          text: error.message,
        })
        .catch(() => undefined)
    } else {
      await api.finish(job, { outcome: 'failed', retryable: true, text: `Error del worker: ${String((error as Error).message ?? error).slice(0, 300)}` }).catch(() => undefined)
    }
    say(`Terminó con error: ${(error as Error).message}`)
  } finally {
    clearInterval(heartbeat)
  }
}

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { api, type ClaimedJob } from './api.js'
import { abortAllAgents } from './claude.js'
import { config } from './config.js'
import { runJob } from './job.js'
import { log } from './log.js'
import { publishWriting } from './steps/publish.js'

/**
 * Worker de la Mac. Pide trabajos al Prospector mientras tenga lugares libres, corre cada uno
 * (auditoría, investigación, construcción, publicación) y avisa de cada paso.
 *
 *   npm start              en marcha continua
 *   npm run once           toma un trabajo, lo termina y sale
 *   npm start -- --dry-run extrae y devuelve el trabajo sin usar Claude (para probar la conexión)
 *
 * Ctrl+C deja de tomar trabajos y espera a los que van en curso; un segundo Ctrl+C (o SIGTERM)
 * los devuelve a la cola, detiene a los agentes y sale. Cada paso deja sus archivos, así que
 * al volver se retoma desde el último paso terminado.
 */

const args = new Set(process.argv.slice(2))
const once = args.has('--once')
const dryRun = args.has('--dry-run')

const running = new Map<number, { job: ClaimedJob; work: Promise<void> }>()
const usedSlots = new Set<number>()
let pausedUntil: Date | null = null
let pauseReason: 'limit' | 'auth' | null = null
let stopping = false
let releasing = false
let handled = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function freeSlot(): number | null {
  for (let i = 0; i < config.concurrency; i++) if (!usedSlots.has(i)) return i
  return null
}

function paused(): boolean {
  if (pausedUntil && pausedUntil.getTime() > Date.now()) return true
  pausedUntil = null
  pauseReason = null
  return false
}

async function tick() {
  const slot = freeSlot()
  const want = !stopping && slot !== null && !paused() && !(once && handled > 0)
  const job = await api.poll({ want, running: running.size, pausedUntil: pausedUntil?.toISOString() ?? null, pauseReason })
  if (!job || slot === null) return false

  handled++
  usedSlots.add(slot)
  log('worker', `Toma la demo ${job.id}: ${job.lead.title} (lugar ${slot + 1} de ${config.concurrency})`)
  const work = runJob(job, slot, {
    dryRun,
    stopping: () => releasing,
    pause: (until, reason) => {
      if (!pausedUntil || until > pausedUntil) {
        pausedUntil = until
        pauseReason = reason
      }
      log(
        'worker',
        reason === 'auth'
          ? `Claude no tiene sesión: pausa hasta ${until.toLocaleTimeString('es-MX')} (corre \`claude setup-token\` y reinicia el worker)`
          : `Límite del plan de Claude: pausa hasta ${until.toLocaleTimeString('es-MX')}`
      )
    },
  }).finally(() => {
    running.delete(job.id)
    usedSlots.delete(slot)
  })
  running.set(job.id, { job, work })
  return true
}

async function main() {
  fs.mkdirSync(config.demosDir, { recursive: true })
  if (config.auth === 'plan' && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    log('worker', 'Aviso: no hay CLAUDE_CODE_OAUTH_TOKEN; Claude usará la sesión de `claude login` de esta Mac si existe')
  }
  log(
    'worker',
    `${config.workerId} conectado a ${config.prospectorUrl} · ${config.concurrency} a la vez · publicar: ${config.publish ? 'sí' : 'no'}${dryRun ? ' · PRUEBA EN SECO' : ''}`
  )

  while (!stopping || running.size > 0) {
    let took = false
    try {
      took = await tick()
    } catch (error) {
      log('worker', `No se pudo hablar con el prospector: ${(error as Error).message}`)
    }
    if (once && handled > 0 && running.size === 0) break
    await sleep(took ? 1500 : config.pollMs)
  }
  log('worker', 'Detenido')
}

/** Devuelve los trabajos en curso a la cola, detiene a los agentes y sus servidores, y sale. */
async function releaseAndExit(reason: string) {
  if (releasing) return
  releasing = true
  stopping = true
  // Una publicación a medias dejaría el repositorio de demos sucio y bloquearía las siguientes.
  const writing = publishWriting()
  if (writing) {
    log('worker', 'Espera a que termine la publicación en curso para no dejar el repositorio a medias')
    await Promise.race([writing.catch(() => undefined), sleep(10 * 60_000)])
  }
  const jobs = [...running.values()].map((r) => r.job)
  log('worker', `${reason}: devuelve ${jobs.length} trabajo(s) a la cola y detiene a los agentes`)
  await Promise.race([
    Promise.allSettled(
      jobs.map((job) => api.finish(job, { outcome: 'released', text: `${config.workerId} se detuvo; vuelve a la cola y retoma donde quedó` }))
    ),
    sleep(8000),
  ])
  abortAllAgents()
  for (let slot = 0; slot < config.concurrency; slot++) {
    const port = config.basePort + slot * 2
    spawnSync('pkill', ['-f', `astro (dev|preview) --port (${port}|${port + 1})`])
  }
  // El SDK cierra a cada agente con ~2 s de gracia; lo que quede lo mata la salida (proc.ts).
  await sleep(3000)
  process.exit(0)
}

// Un solo Ctrl+C puede llegar dos veces (de la terminal y reenviado por npm): las señales
// dentro de 1.5 s cuentan como una.
let lastSignal = 0
function debounced(): boolean {
  const now = Date.now()
  const repeat = now - lastSignal < 1500
  lastSignal = now
  return repeat
}

process.on('SIGINT', () => {
  if (debounced()) return
  if (releasing) process.exit(1)
  if (stopping) return void releaseAndExit('Salida inmediata')
  stopping = true
  log('worker', `Deteniendo: no toma trabajos nuevos y espera ${running.size} en curso (Ctrl+C otra vez para devolverlos a la cola y salir ya)`)
})
// releaseAndExit ya ignora repeticiones; SIGTERM no necesita la espera de Ctrl+C.
process.on('SIGTERM', () => void releaseAndExit('SIGTERM'))

main().catch((error) => {
  log('worker', `Error fatal: ${(error as Error).stack ?? error}`)
  process.exit(1)
})

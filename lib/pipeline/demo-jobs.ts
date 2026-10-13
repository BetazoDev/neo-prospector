import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

/**
 * Cola de demos. El prospector solo guarda el estado; el trabajo pesado (auditoría visual,
 * investigación, construcción en Astro, publicación) lo hace el worker de la Mac, que pide
 * trabajos por la API y avisa de cada paso.
 *
 * Igual que la revisión de sitios, todo es seguro en paralelo: un trabajo se toma con un
 * cambio de estado atómico, y uno cuyo worker dejó de dar señales vuelve a la cola.
 */

/** Sin señales del worker en este tiempo, el trabajo se considera abandonado. */
const STALE_RUN_MS = 25 * 60 * 1000
/** Un worker que no ha hablado en este tiempo se muestra fuera de línea. */
const ONLINE_WINDOW_MS = 90 * 1000
const MAX_ATTEMPTS = 3
const MAX_LOG_ENTRIES = 200
/** Una auditoría que dijo "no vale la pena" no se repite sola durante este tiempo. */
const SKIP_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export const DEMO_STEPS = {
  audit: 'Auditoría visual',
  research: 'Investigación',
  build: 'Construcción',
  publish: 'Publicación',
} as const

export type DemoStep = keyof typeof DEMO_STEPS

export function isDemoStep(value: unknown): value is DemoStep {
  return typeof value === 'string' && value in DEMO_STEPS
}

export interface DemoLogEntry {
  at: string
  step: DemoStep | null
  text: string
}

/** Etapa del lead mientras su demo avanza. */
const STAGE_FOR_STEP: Record<DemoStep, string> = {
  audit: 'queued',
  research: 'researching',
  build: 'building',
  publish: 'building',
}

/** Etapas desde las que un negocio puede entrar a la cola. */
const QUEUEABLE_STAGES = ['candidate', 'unverified', 'site_ok', 'no_site']

/**
 * Pone negocios en la cola. Se salta los que ya tienen una demo en curso o publicada y los
 * descartados. Devuelve cuántos entraron.
 */
export async function enqueueDemos(userId: string, leadIds: number[], { automatic = false } = {}): Promise<number> {
  if (leadIds.length === 0) return 0
  const leads = await prisma.lead.findMany({
    where: { userId, id: { in: leadIds }, stage: { in: QUEUEABLE_STAGES } },
    select: {
      id: true,
      demoJobs: { select: { status: true, updatedAt: true, slug: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  })

  const now = Date.now()
  let queued = 0
  for (const lead of leads) {
    const active = lead.demoJobs.some((j) => j.status === 'queued' || j.status === 'running' || j.status === 'published')
    if (active) continue
    // La cola automática respeta una auditoría reciente que dijo que no; a mano se puede insistir.
    const recentlySkipped = lead.demoJobs.some((j) => j.status === 'skipped' && now - j.updatedAt.getTime() < SKIP_COOLDOWN_MS)
    if (automatic && recentlySkipped) continue
    // Pedirla a mano justo después de un «no» de la auditoría es decidir construirla de todos modos.
    const forced = !automatic && lead.demoJobs[0]?.status === 'skipped'
    // Misma carpeta que el intento anterior: el worker retoma lo que ya extrajo e investigó.
    const slug = lead.demoJobs.find((j) => j.slug)?.slug ?? null

    const entry: DemoLogEntry = {
      at: new Date().toISOString(),
      step: null,
      text: automatic ? 'En cola: la revisión lo marcó como candidato' : forced ? 'En cola, sin el filtro de la auditoría' : 'En cola',
    }
    await prisma.$transaction([
      prisma.demoJob.create({ data: { userId, leadId: lead.id, forced, slug, log: [entry] as unknown as Prisma.InputJsonValue } }),
      prisma.lead.update({ where: { id: lead.id }, data: { stage: 'queued', stageChangedAt: new Date() } }),
    ])
    queued++
  }
  return queued
}

/** La revisión de sitios llama a esto en cuanto un negocio queda como candidato. */
export async function enqueueCandidate(userId: string, leadId: number): Promise<void> {
  if (process.env.DEMO_AUTO_QUEUE === 'false') return
  await enqueueDemos(userId, [leadId], { automatic: true })
}

function claimableWhere(): Prisma.DemoJobWhereInput {
  const now = new Date()
  return {
    OR: [
      { status: 'queued', OR: [{ notBefore: null }, { notBefore: { lte: now } }] },
      {
        status: 'running',
        heartbeatAt: { lt: new Date(now.getTime() - STALE_RUN_MS) },
        attempts: { lt: MAX_ATTEMPTS },
      },
    ],
  }
}

/** Un trabajo que agotó sus intentos y dejó de dar señales ya no vuelve a la cola: queda fallido. */
async function failExhausted() {
  const stale = { status: 'running', heartbeatAt: { lt: new Date(Date.now() - STALE_RUN_MS) }, attempts: { gte: MAX_ATTEMPTS } }
  const jobs = await prisma.demoJob.findMany({ where: stale, select: { id: true, leadId: true } })
  for (const job of jobs) {
    const done = await prisma.demoJob.updateMany({
      where: { id: job.id, ...stale },
      data: { status: 'failed', step: null, error: 'El worker dejó de dar señales en cada intento' },
    })
    if (done.count === 0) continue
    await prisma.lead.updateMany({
      where: { id: job.leadId, stage: { in: ['queued', 'researching', 'building'] } },
      data: { stage: 'candidate', stageChangedAt: new Date() },
    })
    await appendLog(job.id, { step: null, text: `El worker dejó de dar señales en los ${MAX_ATTEMPTS} intentos` })
  }
}

/** El worker pide el siguiente trabajo. Devuelve el trabajo con lo que hace falta del negocio. */
export async function claimDemoJob(workerId: string) {
  await failExhausted()
  const candidates = await prisma.demoJob.findMany({
    where: claimableWhere(),
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: 10,
  })

  for (const { id } of candidates) {
    const now = new Date()
    const won = await prisma.demoJob.updateMany({
      where: { id, ...claimableWhere() },
      data: { status: 'running', workerId, claimedAt: now, heartbeatAt: now, attempts: { increment: 1 }, error: null },
    })
    if (won.count === 0) continue

    const job = await prisma.demoJob.findUnique({
      where: { id },
      include: {
        lead: {
          include: { job: { select: { id: true, name: true, niche: true, zone: true } } },
        },
      },
    })
    if (!job) continue
    await appendLog(id, { step: null, text: `Lo tomó ${workerId} (intento ${job.attempts})` })
    return job
  }
  return null
}

async function appendLog(jobId: number, entry: Omit<DemoLogEntry, 'at'>) {
  const job = await prisma.demoJob.findUnique({ where: { id: jobId }, select: { log: true } })
  const log = (Array.isArray(job?.log) ? job.log : []) as unknown as DemoLogEntry[]
  const next = [...log, { ...entry, at: new Date().toISOString() }].slice(-MAX_LOG_ENTRIES)
  await prisma.demoJob.update({ where: { id: jobId }, data: { log: next as unknown as Prisma.InputJsonValue } })
}

export class DemoJobConflict extends Error {}

/**
 * Quién tiene el trabajo: el nombre del worker y la hora exacta en que lo tomó. La hora hace de
 * contraseña de esa toma: si el trabajo volvió a la cola y otro proceso lo tomó (aunque se llame
 * igual), los avisos atrasados del primero se rechazan.
 */
export interface DemoOwner {
  workerId: string
  lease: string | null
}

/** Solo el worker que tiene el trabajo, en esa misma toma, puede avanzarlo. */
async function ownedRunningJob(jobId: number, owner: DemoOwner) {
  const job = await prisma.demoJob.findUnique({
    where: { id: jobId },
    select: { id: true, leadId: true, workerId: true, status: true, claimedAt: true },
  })
  if (!job || job.workerId !== owner.workerId || job.status !== 'running' || job.claimedAt?.toISOString() !== owner.lease) {
    throw new DemoJobConflict('Este trabajo ya no le pertenece a este worker.')
  }
  return job
}

/** Señal de vida sin mensaje: los pasos largos la mandan para no parecer abandonados. */
export async function heartbeatDemoJob(jobId: number, owner: DemoOwner) {
  await ownedRunningJob(jobId, owner)
  await prisma.demoJob.update({ where: { id: jobId }, data: { heartbeatAt: new Date() } })
}

export interface DemoEvent {
  step?: DemoStep
  text: string
  slug?: string
  audit?: Prisma.InputJsonValue
  research?: Prisma.InputJsonValue
}

export async function recordDemoEvent(jobId: number, owner: DemoOwner, event: DemoEvent) {
  const job = await ownedRunningJob(jobId, owner)
  await prisma.demoJob.update({
    where: { id: jobId },
    data: {
      heartbeatAt: new Date(),
      ...(event.step ? { step: event.step } : {}),
      ...(event.slug ? { slug: event.slug } : {}),
      ...(event.audit !== undefined ? { audit: event.audit } : {}),
      ...(event.research !== undefined ? { research: event.research } : {}),
    },
  })
  await appendLog(jobId, { step: event.step ?? null, text: event.text.slice(0, 500) })
  if (event.step) {
    await prisma.lead.update({ where: { id: job.leadId }, data: { stage: STAGE_FOR_STEP[event.step], stageChangedAt: new Date() } })
  }
}

export type DemoOutcome =
  | { outcome: 'published'; demoUrl: string; slug: string; text?: string }
  | { outcome: 'skipped'; text: string; audit?: Prisma.InputJsonValue }
  | { outcome: 'failed'; text: string; retryable?: boolean; retryAfterMs?: number }
  /** El worker lo devuelve sin culpa del trabajo (límite del plan, prueba, se detuvo): no gasta un intento. */
  | { outcome: 'released'; text: string; retryAfterMs?: number }

export async function finishDemoJob(jobId: number, owner: DemoOwner, result: DemoOutcome) {
  const job = await ownedRunningJob(jobId, owner)
  const current = await prisma.demoJob.findUnique({ where: { id: jobId }, select: { attempts: true } })
  const now = new Date()

  if (result.outcome === 'published') {
    await prisma.$transaction([
      prisma.demoJob.update({ where: { id: jobId }, data: { status: 'published', step: null, demoUrl: result.demoUrl, slug: result.slug, heartbeatAt: now } }),
      prisma.lead.update({
        where: { id: job.leadId },
        data: { stage: 'published', stageChangedAt: now, demoUrl: result.demoUrl, demoSlug: result.slug },
      }),
    ])
    await appendLog(jobId, { step: 'publish', text: result.text ?? `Demo publicada: ${result.demoUrl}` })
    return
  }

  if (result.outcome === 'skipped') {
    // La auditoría visual concluyó que su sitio no amerita una demo.
    await prisma.$transaction([
      prisma.demoJob.update({
        where: { id: jobId },
        data: { status: 'skipped', step: null, heartbeatAt: now, ...(result.audit !== undefined ? { audit: result.audit } : {}) },
      }),
      prisma.lead.update({ where: { id: job.leadId }, data: { stage: 'site_ok', stageChangedAt: now } }),
    ])
    await appendLog(jobId, { step: 'audit', text: result.text })
    return
  }

  if (result.outcome === 'released') {
    await prisma.$transaction([
      prisma.demoJob.update({
        where: { id: jobId },
        data: {
          status: 'queued',
          step: null,
          workerId: null,
          attempts: { decrement: 1 },
          notBefore: result.retryAfterMs ? new Date(now.getTime() + result.retryAfterMs) : null,
        },
      }),
      prisma.lead.update({ where: { id: job.leadId }, data: { stage: 'queued', stageChangedAt: now } }),
    ])
    await appendLog(jobId, { step: null, text: result.text })
    return
  }

  const retry = result.retryable !== false && (current?.attempts ?? 0) < MAX_ATTEMPTS
  await prisma.$transaction([
    prisma.demoJob.update({
      where: { id: jobId },
      data: retry
        ? {
            status: 'queued',
            step: null,
            workerId: null,
            error: result.text.slice(0, 500),
            notBefore: new Date(now.getTime() + (result.retryAfterMs ?? 5 * 60 * 1000)),
          }
        : { status: 'failed', step: null, error: result.text.slice(0, 500), heartbeatAt: now },
    }),
    prisma.lead.update({ where: { id: job.leadId }, data: { stage: retry ? 'queued' : 'candidate', stageChangedAt: now } }),
  ])
  await appendLog(jobId, { step: null, text: retry ? `${result.text} · se reintentará` : result.text })
}

/** Cancela un trabajo que todavía no empieza. El negocio vuelve a ser candidato. */
export async function cancelDemoJob(userId: string, jobId: number): Promise<boolean> {
  const job = await prisma.demoJob.findFirst({ where: { id: jobId, userId, status: 'queued' }, select: { leadId: true } })
  if (!job) return false
  const done = await prisma.demoJob.updateMany({ where: { id: jobId, status: 'queued' }, data: { status: 'canceled' } })
  if (done.count === 0) return false
  await prisma.lead.updateMany({ where: { id: job.leadId, stage: 'queued' }, data: { stage: 'candidate', stageChangedAt: new Date() } })
  await appendLog(jobId, { step: null, text: 'Cancelado' })
  return true
}

export interface WorkerPing {
  version?: string
  running?: number
  capacity?: number
  pausedUntil?: string | null
  pauseReason?: 'limit' | 'auth' | null
}

export async function touchWorker(workerId: string, ping: WorkerPing = {}) {
  const data = {
    lastSeenAt: new Date(),
    ...(ping.version ? { version: ping.version.slice(0, 40) } : {}),
    ...(typeof ping.running === 'number' ? { running: ping.running } : {}),
    ...(typeof ping.capacity === 'number' ? { capacity: ping.capacity } : {}),
    ...(ping.pausedUntil !== undefined ? { pausedUntil: ping.pausedUntil ? new Date(ping.pausedUntil) : null } : {}),
    ...(ping.pauseReason !== undefined ? { pauseReason: ping.pausedUntil ? ping.pauseReason : null } : {}),
  }
  await prisma.worker.upsert({ where: { id: workerId }, create: { id: workerId, ...data }, update: data })
}

/** Lo que la barra superior muestra de la cola de demos y del worker. */
export async function demoActivity(userId: string) {
  const [workers, queued, running] = await Promise.all([
    prisma.worker.findMany({ where: { lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } } }),
    prisma.demoJob.count({ where: { userId, status: 'queued' } }),
    prisma.demoJob.findMany({
      where: { userId, status: 'running' },
      orderBy: { claimedAt: 'asc' },
      take: 8,
      select: { id: true, step: true, leadId: true, lead: { select: { title: true, jobId: true } } },
    }),
  ])
  const now = Date.now()
  // Con varios equipos, la pausa que se muestra es la que termina primero.
  const pause = workers
    .filter((w) => w.pausedUntil && w.pausedUntil.getTime() > now)
    .sort((a, b) => a.pausedUntil!.getTime() - b.pausedUntil!.getTime())[0]
  return {
    worker: workers.length
      ? {
          online: true,
          names: workers.map((w) => w.id),
          capacity: workers.reduce((sum, w) => sum + w.capacity, 0),
          pausedUntil: pause?.pausedUntil?.toISOString() ?? null,
          pauseReason: pause ? (pause.pauseReason === 'auth' ? ('auth' as const) : ('limit' as const)) : null,
        }
      : { online: false, names: [], capacity: 0, pausedUntil: null, pauseReason: null },
    queued,
    running: running.map((j) => ({
      jobId: j.id,
      leadId: j.leadId,
      baseId: j.lead.jobId,
      title: j.lead.title,
      step: j.step as DemoStep | null,
    })),
  }
}

export async function demoJobsForLead(userId: string, leadId: number) {
  return prisma.demoJob.findMany({
    where: { userId, leadId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, status: true, step: true, log: true, demoUrl: true, slug: true, audit: true, research: true, error: true, attempts: true, createdAt: true, updatedAt: true, notBefore: true },
  })
}

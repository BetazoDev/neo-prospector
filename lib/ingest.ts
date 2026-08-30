import { prisma } from './prisma'
import {
  APIFY_PENDING_STATUSES,
  ApifyRequestError,
  fetchApifyResults,
  getApifyRun,
  type ApifyLead,
} from './apify'

/** Una importación que lleve más de esto colgada se considera abandonada y se puede retomar. */
const STALE_IMPORT_MS = 10 * 60 * 1000
/** Cuántos jobs colgados reconciliamos como mucho en una pasada de fondo. */
const RECONCILE_BATCH = 5
/**
 * Filas por INSERT. Postgres admite 65535 parámetros por sentencia y cada lead ocupa 14,
 * así que insertar un dataset grande de una sola vez reventaría el límite.
 */
const INSERT_CHUNK_SIZE = 1000

export type SyncOutcome =
  /** La corrida sigue viva en Apify. */
  | { state: 'pending'; runStatus: string }
  /** Los leads quedaron guardados en esta llamada o ya lo estaban. */
  | { state: 'done'; count: number }
  | { state: 'error'; message: string }
  /** Otra llamada está importando este mismo job ahora mismo. */
  | { state: 'busy' }

function toApifyError(status: string): string {
  if (status === 'ABORTED') return 'La corrida fue cancelada en Apify.'
  if (status === 'TIMED-OUT') return 'La corrida excedió el tiempo límite configurado en Apify.'
  return `La corrida terminó en estado ${status}.`
}

async function markError(jobId: number, message: string): Promise<SyncOutcome> {
  await prisma.scrapingJob.update({
    where: { id: jobId },
    data: { status: 'error', error: message.slice(0, 500) },
  })
  return { state: 'error', message }
}

/**
 * Devuelve el job a "running" tras un fallo al guardar.
 *
 * El dataset sigue en Apify, así que reintentar no cuesta otra corrida: la reconciliación
 * volverá a intentarlo. El motivo queda guardado para que el fallo sea visible y no se
 * confunda con una extracción que simplemente va lenta.
 */
async function markRetryable(jobId: number, message: string): Promise<SyncOutcome> {
  await prisma.scrapingJob.update({
    where: { id: jobId },
    data: { status: 'running', error: message.slice(0, 500) },
  })
  return { state: 'pending', runStatus: 'reintentando el guardado' }
}

function mapLead(item: ApifyLead, userId: string, jobId: number, niche: string, zone: string) {
  return {
    userId,
    jobId,
    title: item.title ?? 'Sin nombre',
    phone: item.phone ?? null,
    rating: item.totalScore ?? null,
    reviewsCount: item.reviewsCount ?? null,
    category: item.categoryName ?? null,
    address: item.address ?? null,
    city: item.city ?? null,
    website: item.website ?? null,
    mapsUrl: item.url ?? null,
    searchNiche: niche,
    searchZone: zone,
    countryCode: item.countryCode?.trim().toLowerCase() || null,
  }
}

/**
 * Lleva un job hasta su estado final consultando Apify.
 *
 * Es idempotente y seguro de llamar en paralelo: toma el job con un cambio de estado
 * atómico antes de importar, y reescribe los leads del job en lugar de añadirlos, así
 * que un reintento tras una caída a medias no deja duplicados.
 */
export async function syncScrapingJob(jobId: number): Promise<SyncOutcome> {
  const job = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    include: { user: { select: { apifyApiKey: true } } },
  })

  if (!job) return { state: 'error', message: 'La base ya no existe.' }

  if (job.status === 'done') {
    return { state: 'done', count: job.leadsFound }
  }
  if (job.status === 'error') {
    return { state: 'error', message: job.error ?? 'La búsqueda terminó con error.' }
  }
  if (!job.apifyRunId) {
    return markError(jobId, 'La búsqueda no llegó a lanzarse en Apify.')
  }

  const apiKey = job.user?.apifyApiKey?.trim() || process.env.APIFY_API_KEY?.trim() || ''
  if (!apiKey) {
    return markError(jobId, 'No hay una API Key de Apify disponible para recuperar esta búsqueda.')
  }

  let run
  try {
    run = await getApifyRun(job.apifyRunId, apiKey)
  } catch (error) {
    // Una clave rechazada o una corrida inexistente no mejoran reintentando.
    if (error instanceof ApifyRequestError && error.isTerminal) {
      return markError(jobId, error.message)
    }
    // Un fallo de red pasajero sí: dejamos el job vivo y se reintenta luego.
    return { state: 'pending', runStatus: 'sin respuesta de Apify' }
  }

  if (APIFY_PENDING_STATUSES.has(run.status)) {
    return { state: 'pending', runStatus: run.status }
  }

  if (run.status !== 'SUCCEEDED') {
    return markError(jobId, toApifyError(run.status))
  }

  if (!run.datasetId) {
    return markError(jobId, 'La corrida terminó pero Apify no expuso un dataset de resultados.')
  }

  // Toma atómica del job: solo una llamada puede pasar de "running" a "importing".
  const claimed = await prisma.scrapingJob.updateMany({
    where: { id: jobId, status: 'running' },
    data: { status: 'importing', apifyDatasetId: run.datasetId },
  })

  if (claimed.count === 0) {
    const current = await prisma.scrapingJob.findUnique({
      where: { id: jobId },
      select: { status: true, updatedAt: true, leadsFound: true, error: true },
    })

    if (!current) return { state: 'error', message: 'La base ya no existe.' }
    if (current.status === 'done') return { state: 'done', count: current.leadsFound }
    if (current.status === 'error') {
      return { state: 'error', message: current.error ?? 'La búsqueda terminó con error.' }
    }

    const stale = Date.now() - current.updatedAt.getTime() > STALE_IMPORT_MS
    if (!stale) return { state: 'busy' }

    // Una importación anterior murió a mitad. La retomamos.
    const retaken = await prisma.scrapingJob.updateMany({
      where: { id: jobId, status: 'importing', updatedAt: current.updatedAt },
      data: { status: 'importing', apifyDatasetId: run.datasetId },
    })
    if (retaken.count === 0) return { state: 'busy' }
  }

  try {
    const items = await fetchApifyResults(run.datasetId, apiKey)
    const leads = items.map((item) => mapLead(item, job.userId, job.id, job.niche, job.zone))

    // Reescribir en vez de añadir mantiene la importación repetible. Todo en una sola
    // transacción, para que un fallo a mitad no deje la base con leads incompletos.
    const writes = [prisma.lead.deleteMany({ where: { jobId } })]
    for (let i = 0; i < leads.length; i += INSERT_CHUNK_SIZE) {
      writes.push(prisma.lead.createMany({ data: leads.slice(i, i + INSERT_CHUNK_SIZE) }))
    }
    await prisma.$transaction(writes)

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: { status: 'done', leadsFound: leads.length, error: null },
    })

    return { state: 'done', count: leads.length }
  } catch (error) {
    // El detalle técnico va al log del servidor; el usuario ve algo accionable.
    console.error(`[ingest] job ${jobId}:`, error)
    return markRetryable(
      jobId,
      'La corrida terminó en Apify pero falló el guardado de resultados. Se reintentará solo; no hace falta relanzar la búsqueda.'
    )
  }
}

/**
 * Recupera en segundo plano los jobs que quedaron colgados, por ejemplo si el navegador
 * se cerró antes de terminar o si el webhook de Apify nunca llegó.
 */
export async function reconcileRunningJobs(userId: string): Promise<void> {
  const stuck = await prisma.scrapingJob.findMany({
    where: {
      userId,
      status: { in: ['running', 'importing'] },
      apifyRunId: { not: null },
    },
    orderBy: { updatedAt: 'asc' },
    take: RECONCILE_BATCH,
    select: { id: true },
  })

  for (const job of stuck) {
    try {
      await syncScrapingJob(job.id)
    } catch (error) {
      console.error(`[reconcile] job ${job.id}:`, error)
    }
  }
}

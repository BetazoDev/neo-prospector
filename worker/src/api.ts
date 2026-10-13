import { config } from './config.js'

export interface ClaimedLead {
  id: number
  title: string
  phone: string | null
  phoneDigits: string | null
  rating: number | null
  reviewsCount: number | null
  category: string | null
  address: string | null
  city: string | null
  website: string | null
  mapsUrl: string | null
  domain: string | null
  siteKind: string | null
  siteStatus: string | null
  siteScore: number | null
  siteIssues: { code: string; label: string; weight: number }[] | null
  siteWhatsapp: string[]
  job: { id: number; name: string | null; niche: string; zone: string }
}

export interface ClaimedJob {
  id: number
  /** Hora en que este proceso lo tomó; va en cada aviso para probar que la toma sigue vigente. */
  claimedAt: string
  attempts: number
  /** Pedida a mano tras un «no» de la auditoría: se construye sin ese filtro. */
  forced: boolean
  slug: string | null
  lead: ClaimedLead
}

export type Step = 'audit' | 'research' | 'build' | 'publish'

export type Outcome =
  | { outcome: 'published'; demoUrl: string; slug: string; text?: string }
  | { outcome: 'skipped'; text: string; audit?: unknown }
  | { outcome: 'failed'; text: string; retryable?: boolean; retryAfterMs?: number }
  /** Vuelve a la cola sin gastar un intento: límite del plan, prueba en seco, worker detenido. */
  | { outcome: 'released'; text: string; retryAfterMs?: number }

/** Lo que identifica una toma: el trabajo y la hora en que se tomó. */
export type JobRef = Pick<ClaimedJob, 'id' | 'claimedAt'>

async function call<T>(pathname: string, body: unknown, lease?: string): Promise<T> {
  const res = await fetch(`${config.prospectorUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.workerToken}`,
      'X-Worker-Id': config.workerId,
      ...(lease ? { 'X-Job-Lease': lease } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${pathname} respondió ${res.status}: ${data.error ?? ''}`.trim())
  return data as T
}

export const api = {
  /** Señal de vida; con `want` pide además el siguiente trabajo. */
  async poll(state: { want: boolean; running: number; pausedUntil: string | null; pauseReason: 'limit' | 'auth' | null }): Promise<ClaimedJob | null> {
    const data = await call<{ job: ClaimedJob | null }>('/api/worker/claim', {
      want: state.want,
      running: state.running,
      capacity: config.concurrency,
      pausedUntil: state.pausedUntil,
      pauseReason: state.pauseReason,
      version: config.version,
    })
    return data.job
  },

  async event(job: JobRef, event: { text: string; step?: Step; slug?: string; audit?: unknown; research?: unknown }) {
    await call(`/api/worker/jobs/${job.id}/events`, event, job.claimedAt)
  },

  async heartbeat(job: JobRef) {
    await call(`/api/worker/jobs/${job.id}/events`, { quiet: true }, job.claimedAt)
  },

  async finish(job: JobRef, outcome: Outcome) {
    await call(`/api/worker/jobs/${job.id}/finish`, outcome, job.claimedAt)
  },
}

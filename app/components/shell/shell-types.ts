export interface RecentBase {
  id: number
  name: string
  status: string
  candidates: number
  checking: boolean
}

export type Activity =
  | { kind: 'scrape'; jobId: number; name: string; status: string; startedAt: string }
  | { kind: 'checks'; jobId: number; name: string; done: number; total: number }
  | { kind: 'demo'; jobId: number; leadId: number; name: string; step: 'audit' | 'research' | 'build' | 'publish' | null }

export interface DemoQueue {
  worker: { online: boolean; names: string[]; capacity: number; pausedUntil: string | null; pauseReason: 'limit' | 'auth' | null }
  queued: number
}

export interface ShellData {
  stages: Record<string, number>
  recent: RecentBase[]
  activity: Activity[]
  demos?: DemoQueue
}

export const DEMO_STEP_LABEL = {
  audit: 'Auditoría visual',
  research: 'Investigando',
  build: 'Construyendo la demo',
  publish: 'Publicando',
} as const

/** Etapas del riel superior. La clave de URL va en español; `segment` es el filtro de la API. */
export const RAIL_STAGES = [
  { slug: 'candidatos', segment: 'candidates', label: 'Candidatos', stages: ['candidate'], hot: true },
  { slug: 'revision', segment: 'unverified', label: 'Revisión manual', stages: ['unverified'] },
  { slug: 'preparando', segment: 'preparing', label: 'Preparando demo', stages: ['queued', 'researching', 'building'] },
  { slug: 'demo', segment: 'published', label: 'Demo lista', stages: ['published'] },
  { slug: 'contactados', segment: 'contacted', label: 'Contactados', stages: ['contacted'] },
  { slug: 'respondieron', segment: 'replied', label: 'Respondieron', stages: ['replied'] },
  { slug: 'clientes', segment: 'won', label: 'Clientes', stages: ['won'] },
] as const

export type RailStage = (typeof RAIL_STAGES)[number]

export function stageCount(stages: Record<string, number>, rail: RailStage): number {
  return rail.stages.reduce((sum, s) => sum + (stages[s] ?? 0), 0)
}

/**
 * Etapas del embudo de un lead. El orden es el del proceso: scraping, clasificación,
 * revisión del sitio y, en las fases siguientes, demo y contacto.
 */
export const STAGES = {
  new: { label: 'Sin clasificar', tone: 'muted' },
  no_site: { label: 'Sin sitio propio', tone: 'muted' },
  to_check: { label: 'Por revisar', tone: 'muted' },
  candidate: { label: 'Candidato', tone: 'accent' },
  unverified: { label: 'Revisión manual', tone: 'warn' },
  site_ok: { label: 'Sitio aceptable', tone: 'muted' },
  queued: { label: 'En cola para demo', tone: 'accent' },
  researching: { label: 'Investigando', tone: 'accent' },
  building: { label: 'Construyendo demo', tone: 'accent' },
  published: { label: 'Demo publicada', tone: 'good' },
  contacted: { label: 'Contactado', tone: 'good' },
  replied: { label: 'Respondió', tone: 'good' },
  won: { label: 'Cliente', tone: 'good' },
  lost: { label: 'No le interesó', tone: 'muted' },
  discarded: { label: 'Descartado', tone: 'muted' },
} as const

export type Stage = keyof typeof STAGES

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && value in STAGES
}

/**
 * Etapas que la revisión automática puede reescribir. Lo que ya avanzó (demo, contacto)
 * o lo que el usuario decidió a mano no se pisa al volver a revisar un sitio.
 */
export const AUTO_STAGES: ReadonlySet<Stage> = new Set([
  'new',
  'no_site',
  'to_check',
  'candidate',
  'unverified',
  'site_ok',
])

/** Agrupaciones que ofrece el filtro de la tabla. */
export const SEGMENTS = {
  all: { label: 'Todos', stages: null },
  candidates: { label: 'Candidatos', stages: ['candidate'] },
  unverified: { label: 'Revisión manual', stages: ['unverified'] },
  site_ok: { label: 'Sitio aceptable', stages: ['site_ok'] },
  no_site: { label: 'Sin sitio', stages: ['no_site'] },
  pending: { label: 'Por revisar', stages: ['new', 'to_check'] },
  preparing: { label: 'Preparando demo', stages: ['queued', 'researching', 'building'] },
  published: { label: 'Demo lista', stages: ['published'] },
  contacted: { label: 'Contactados', stages: ['contacted'] },
  replied: { label: 'Respondieron', stages: ['replied'] },
  won: { label: 'Clientes', stages: ['won'] },
  outreach: { label: 'En contacto', stages: ['contacted', 'replied', 'won'] },
  discarded: { label: 'Descartados', stages: ['discarded', 'lost'] },
} as const satisfies Record<string, { label: string; stages: readonly Stage[] | null }>

export type Segment = keyof typeof SEGMENTS

export function isSegment(value: unknown): value is Segment {
  return typeof value === 'string' && value in SEGMENTS
}

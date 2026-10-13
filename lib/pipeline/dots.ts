/**
 * Cada negocio se dibuja como un punto. Este módulo traduce un lead a su estado de punto
 * con una sola letra, para que una base de cientos de negocios viaje como una cadena corta.
 * No tiene dependencias de servidor: lo usan la API y los componentes.
 */

export const DOT_STATES = {
  c: { label: 'Candidato', order: 0 },
  w: { label: 'Preparando demo', order: 1 },
  d: { label: 'Demo lista', order: 2 },
  k: { label: 'Contactado', order: 3 },
  u: { label: 'Revisión manual', order: 4 },
  o: { label: 'Sitio aceptable', order: 5 },
  n: { label: 'Sin sitio propio', order: 6 },
  r: { label: 'Revisando ahora', order: 7 },
  p: { label: 'Por revisar', order: 8 },
  x: { label: 'Descartado', order: 9 },
} as const

export type DotState = keyof typeof DOT_STATES

export function dotState(lead: { stage: string; checkState: string | null }): DotState {
  switch (lead.stage) {
    case 'candidate':
      return 'c'
    case 'queued':
    case 'researching':
    case 'building':
      return 'w'
    case 'published':
      return 'd'
    case 'contacted':
    case 'replied':
    case 'won':
      return 'k'
    case 'unverified':
      return 'u'
    case 'site_ok':
      return 'o'
    case 'no_site':
      return 'n'
    case 'discarded':
    case 'lost':
      return 'x'
    default:
      return lead.checkState === 'running' ? 'r' : 'p'
  }
}

export function countDots(dots: string): Partial<Record<DotState, number>> {
  const counts: Partial<Record<DotState, number>> = {}
  for (const ch of dots) counts[ch as DotState] = (counts[ch as DotState] ?? 0) + 1
  return counts
}

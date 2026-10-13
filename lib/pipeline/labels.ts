/** Textos para la interfaz. Sin dependencias de servidor: lo importan componentes cliente. */

export const SITE_STATUS: Record<string, { label: string; tone: 'accent' | 'warn' | 'good' | 'muted' }> = {
  ok: { label: 'Funciona', tone: 'muted' },
  broken: { label: 'Con errores', tone: 'accent' },
  dead: { label: 'Caído', tone: 'accent' },
  parked: { label: 'Estacionado', tone: 'accent' },
  construction: { label: 'En construcción', tone: 'accent' },
  hacked: { label: 'Hackeado', tone: 'accent' },
  social: { label: 'Redirige a redes', tone: 'accent' },
  unverified: { label: 'Sin verificar', tone: 'warn' },
}

export const SITE_KIND: Record<string, string> = {
  social: 'Solo redes sociales',
  whatsapp: 'Solo WhatsApp',
  none: 'Sin sitio web',
}

/** Desde aquí la puntuación se pinta con el acento. Coincide con CANDIDATE_SCORE. */
export const HIGH_SCORE = 30

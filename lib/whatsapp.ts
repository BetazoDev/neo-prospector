export interface ContactNumber {
  digits: string
  /** "sitio": lo publica el propio negocio como WhatsApp. "maps": es el teléfono de su ficha. */
  source: 'sitio' | 'maps'
}

/**
 * Número al que conviene escribir. El WhatsApp que el negocio publica en su sitio es
 * seguro; el teléfono de Maps muchas veces es un fijo, así que va como respaldo.
 */
export function contactNumber(lead: { siteWhatsapp?: string[] | null; phoneDigits?: string | null }): ContactNumber | null {
  const fromSite = lead.siteWhatsapp?.[0]
  if (fromSite) return { digits: fromSite, source: 'sitio' }
  if (lead.phoneDigits) return { digits: lead.phoneDigits, source: 'maps' }
  return null
}

/** Primer mensaje: solo confirma que es el WhatsApp del negocio, sin vender nada todavía. */
export function getWaUrl(digits: string, empresa: string): string {
  const text = `Hola, buen día. ¿Es el WhatsApp de ${empresa}?`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

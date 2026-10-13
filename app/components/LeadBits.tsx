'use client'

import { MessageCircle } from 'lucide-react'
import { HIGH_SCORE, SITE_KIND, SITE_STATUS } from '@/lib/pipeline/labels'
import { STAGES, type Stage } from '@/lib/pipeline/stages'
import { dotState } from '@/lib/pipeline/dots'
import { contactNumber, getWaUrl } from '@/lib/whatsapp'
import type { Lead } from './lead-types'

const TONE_CLASS = { accent: 'chip chip-accent', warn: 'chip chip-warn', good: 'chip chip-good', muted: 'chip' } as const

export function StageChip({ stage }: { stage: string }) {
  const info = STAGES[stage as Stage]
  if (!info) return <span className="chip">{stage}</span>
  return <span className={TONE_CLASS[info.tone]}>{info.label}</span>
}

/** Estado del sitio en una etiqueta: lo que encontró la revisión o por qué no hay qué revisar. */
export function SiteChip({ lead }: { lead: Lead }) {
  if (lead.siteKind && lead.siteKind !== 'web') return <span className="chip">{SITE_KIND[lead.siteKind]}</span>
  if (lead.checkState === 'pending' || lead.checkState === 'running' || lead.checkState === null) {
    return <span className="chip">{lead.checkState === 'running' ? 'Revisando…' : 'Por revisar'}</span>
  }
  if (lead.checkState === 'error') return <span className="chip chip-warn">No se pudo revisar</span>
  const status = SITE_STATUS[lead.siteStatus ?? 'ok'] ?? SITE_STATUS.ok
  return <span className={TONE_CLASS[status.tone]}>{status.label}</span>
}

/** Punto del campo y puntuación: el mismo color que el negocio tiene en el campo de puntos. */
export function Score({ lead }: { lead: Lead }) {
  const high = (lead.siteScore ?? 0) >= HIGH_SCORE
  return (
    <div className={`score ${high ? 'is-high' : ''}`} title="Oportunidad de rediseño, de 0 a 100">
      <span className={`dot dot-${dotState(lead)}`} aria-hidden="true" />
      <span className={`num ${lead.siteScore === null ? 'is-none' : ''}`}>{lead.siteScore ?? '–'}</span>
    </div>
  )
}

/** Los hallazgos con peso, del más grave al más leve. */
export function findings(lead: Lead) {
  return (lead.siteIssues ?? []).filter((i) => i.weight > 0)
}

export function displayDomain(lead: Lead): string | null {
  if (lead.domain) return lead.domain
  return lead.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
}

export function siteHref(lead: Lead): string | null {
  if (!lead.website) return null
  return lead.website.startsWith('http') ? lead.website : `https://${lead.website}`
}

export function whyLine(lead: Lead): string {
  const top = findings(lead)[0]
  if (top) return top.label
  if (lead.siteKind && lead.siteKind !== 'web') return 'No tiene sitio propio: se le puede proponer uno nuevo'
  if (lead.checkState === 'pending' || lead.checkState === 'running' || !lead.checkState) return 'Su sitio está en la cola de revisión'
  return 'Sin problemas evidentes en la revisión automática'
}

export function WhatsAppButton({ lead, primary = false }: { lead: Lead; primary?: boolean }) {
  const contact = contactNumber(lead)
  if (!contact) return <span className="no-contact">Sin teléfono</span>
  const fromSite = contact.source === 'sitio'
  return (
    <a
      href={getWaUrl(contact.digits, lead.title)}
      target="_blank"
      rel="noopener noreferrer"
      className={`wa-btn${primary ? ' is-primary' : fromSite ? '' : ' is-guess'}`}
      title={fromSite ? 'WhatsApp que publica en su sitio' : 'Teléfono de Google Maps: puede no tener WhatsApp'}
      onClick={(e) => e.stopPropagation()}
    >
      <MessageCircle aria-hidden="true" />
      {fromSite ? 'WhatsApp' : 'Probar WhatsApp'}
    </a>
  )
}

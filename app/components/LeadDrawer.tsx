'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Star, X } from 'lucide-react'
import { HIGH_SCORE } from '@/lib/pipeline/labels'
import { getWaUrl } from '@/lib/whatsapp'
import type { Lead, LeadAction } from './lead-types'
import { findings, SiteChip, siteHref, StageChip, WhatsAppButton } from './LeadBits'
import DemoPanel from './DemoPanel'

interface LeadDrawerProps {
  lead: Lead | null
  onClose: () => void
  onAction: (lead: Lead, action: LeadAction) => void
  busy?: boolean
  /** Posición dentro de la lista visible, para recorrerla sin cerrar la ficha. */
  position?: { index: number; total: number } | null
  onPrev?: () => void
  onNext?: () => void
  showBase?: boolean
  /** La cola de demos cambió desde la ficha: refrescar lista y barra. */
  onDemoChanged?: () => void
  toast?: (title: string, desc?: string, type?: 'success' | 'error') => void
}

function formatDigits(digits: string): string {
  if (digits.startsWith('52') && digits.length === 12) {
    const n = digits.slice(2)
    return ['55', '56', '33', '81'].includes(n.slice(0, 2))
      ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`
      : `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  }
  return `+${digits}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Ficha de un negocio: por qué necesita un sitio nuevo, qué se sabe de su sitio y cómo escribirle. */
export default function LeadDrawer({
  lead,
  onClose,
  onAction,
  busy = false,
  position,
  onPrev,
  onNext,
  showBase,
  onDemoChanged = () => {},
  toast = () => {},
}: LeadDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = !!lead

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape') onClose()
      else if (!typing && (e.key === 'j' || e.key === 'ArrowDown')) {
        e.preventDefault()
        onNext?.()
      } else if (!typing && (e.key === 'k' || e.key === 'ArrowUp')) {
        e.preventDefault()
        onPrev?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, onNext, onPrev])

  if (!lead) return null

  const all = lead.siteIssues ?? []
  const weighted = findings(lead)
  const notes = all.filter((i) => i.weight <= 0)
  const href = siteHref(lead)
  const finalHref = lead.finalUrl && lead.finalUrl !== href ? lead.finalUrl : null
  const canPromote = lead.stage === 'site_ok' || lead.stage === 'unverified'
  const discarded = lead.stage === 'discarded'
  const high = (lead.siteScore ?? 0) >= HIGH_SCORE

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div className="drawer-nav">
            {position && (
              <>
                <button type="button" className="icon-btn" onClick={onPrev} disabled={position.index === 0} aria-label="Negocio anterior (K)">
                  <ChevronUp aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onNext}
                  disabled={position.index >= position.total - 1}
                  aria-label="Negocio siguiente (J)"
                >
                  <ChevronDown aria-hidden="true" />
                </button>
              </>
            )}
            <span className="grow">
              {position ? `${position.index + 1} de ${position.total}` : ''}
              {position && <span className="only-desktop" style={{ display: 'inline' }}> · J y K para recorrer</span>}
            </span>
            <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar ficha">
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="drawer-id">
            <div className={`drawer-score ${high ? 'is-high' : ''}`}>
              <span className="num">{lead.siteScore ?? '–'}</span>
              <span className="label">Oportunidad</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="drawer-title" id="drawer-title">
                {lead.title}
              </h2>
              <div className="drawer-sub">
                <StageChip stage={lead.stage} />
                <span>{[lead.category, lead.city].filter(Boolean).join(' · ')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-body">
          <DemoPanel key={lead.id} lead={lead} onChanged={onDemoChanged} toast={toast} />

          <section className="drawer-section">
            <h3>
              Por qué <span className="label">peso</span>
            </h3>
            {lead.checkError && <p className="drawer-note">La revisión falló: {lead.checkError}</p>}
            {weighted.length === 0 && notes.length === 0 && !lead.checkError && (
              <p className="drawer-note" style={{ marginTop: 0 }}>
                {lead.siteKind && lead.siteKind !== 'web'
                  ? 'No tiene sitio propio. Se le puede proponer uno nuevo desde cero con lo que publica en Google y en sus redes.'
                  : lead.checkState === 'done'
                    ? 'La revisión automática no encontró problemas evidentes. La revisión visual de la siguiente etapa mira el diseño y el contenido.'
                    : 'Su sitio está en la cola de revisión.'}
              </p>
            )}
            {(weighted.length > 0 || notes.length > 0) && (
              <ul className="findings">
                {weighted.map((issue) => (
                  <li key={issue.code} className={`finding ${issue.weight >= 25 ? 'is-high' : ''}`}>
                    <span>{issue.label}</span>
                    <span className="finding-weight">+{issue.weight}</span>
                  </li>
                ))}
                {notes.map((issue) => (
                  <li key={issue.code} className="finding">
                    <span>{issue.label}</span>
                    <span className="finding-weight">{issue.weight < 0 ? issue.weight : 'nota'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="drawer-section">
            <h3>Sitio web</h3>
            <dl className="kv">
              <dt>Sitio</dt>
              <dd>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {lead.website}
                  </a>
                ) : (
                  'No tiene'
                )}
              </dd>
              {finalHref && (
                <>
                  <dt>Termina en</dt>
                  <dd>
                    <a href={finalHref} target="_blank" rel="noopener noreferrer">
                      {finalHref}
                    </a>
                  </dd>
                </>
              )}
              <dt>Estado</dt>
              <dd>
                <SiteChip lead={lead} />
              </dd>
              {lead.siteTitle && (
                <>
                  <dt>Título</dt>
                  <dd>{lead.siteTitle}</dd>
                </>
              )}
              {lead.siteCms && (
                <>
                  <dt>Plataforma</dt>
                  <dd>{lead.siteCms}</dd>
                </>
              )}
              {lead.httpStatus !== null && (
                <>
                  <dt>Respuesta</dt>
                  <dd>HTTP {lead.httpStatus}</dd>
                </>
              )}
              {lead.checkedAt && (
                <>
                  <dt>Revisado</dt>
                  <dd>{formatDate(lead.checkedAt)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Contacto</h3>
            <dl className="kv">
              {lead.siteWhatsapp.length > 0 && (
                <>
                  <dt>WhatsApp del sitio</dt>
                  <dd style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {lead.siteWhatsapp.map((digits) => (
                      <a key={digits} href={getWaUrl(digits, lead.title)} target="_blank" rel="noopener noreferrer">
                        {formatDigits(digits)}
                      </a>
                    ))}
                  </dd>
                </>
              )}
              <dt>Teléfono</dt>
              <dd>{lead.phoneDigits ? <a href={`tel:+${lead.phoneDigits}`}>{lead.phone}</a> : (lead.phone ?? '—')}</dd>
              {lead.address && (
                <>
                  <dt>Dirección</dt>
                  <dd>{lead.address}</dd>
                </>
              )}
              {lead.rating !== null && (
                <>
                  <dt>Google</dt>
                  <dd style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Star aria-hidden="true" style={{ width: 14, height: 14, color: '#b07800', fill: 'currentColor' }} />
                    {lead.rating.toFixed(1)}
                    {lead.reviewsCount ? ` · ${lead.reviewsCount.toLocaleString('es-MX')} reseñas` : ''}
                  </dd>
                </>
              )}
              {lead.mapsUrl && (
                <>
                  <dt>Ficha</dt>
                  <dd>
                    <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer">
                      Abrir en Google Maps
                    </a>
                  </dd>
                </>
              )}
              {showBase && lead.job && (
                <>
                  <dt>Base</dt>
                  <dd>
                    <Link href={`/bases/${lead.job.id}`}>{lead.job.name || `${lead.job.niche} · ${lead.job.zone}`}</Link>
                  </dd>
                </>
              )}
            </dl>
            {lead.siteWhatsapp.length === 0 && lead.phoneDigits && (
              <p className="drawer-note">
                Su sitio no publica un WhatsApp. El teléfono de Maps puede ser un fijo; la investigación de la siguiente etapa busca el
                número real en sus redes.
              </p>
            )}
          </section>
        </div>

        <div className="drawer-foot">
          <WhatsAppButton lead={lead} primary />
          <span className="grow" />
          {lead.siteKind === 'web' && (
            <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => onAction(lead, 'recheck')}>
              Revisar de nuevo
            </button>
          )}
          {canPromote && (
            <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => onAction(lead, 'promote')}>
              Marcar candidato
            </button>
          )}
          <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => onAction(lead, discarded ? 'restore' : 'discard')}>
            {discarded ? 'Devolver' : 'Descartar'}
          </button>
        </div>
      </aside>
    </>
  )
}

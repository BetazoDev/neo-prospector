'use client'

import { ExternalLink, MapPin, MoreHorizontal, RotateCcw, Ban, Trash2, RefreshCw, Sparkles, Star } from 'lucide-react'
import type { Lead, LeadAction } from './lead-types'
import { displayDomain, findings, Score, SiteChip, siteHref, whyLine, WhatsAppButton } from './LeadBits'
import { usePopover } from './shell/usePopover'

interface LeadListProps {
  leads: Lead[]
  loading: boolean
  /** La base tiene negocios pero el filtro dejó la lista vacía. */
  filtered: boolean
  showBase?: boolean
  activeId?: number | null
  page: number
  pages: number
  total: number
  onPage: (page: number) => void
  onOpen: (lead: Lead) => void
  onHover?: (id: number | null) => void
  onAction: (lead: Lead, action: LeadAction) => void
  onDelete: (lead: Lead) => void
  emptyTitle?: string
  emptyText?: string
}

function RowMenu({ lead, onAction, onDelete }: { lead: Lead; onAction: LeadListProps['onAction']; onDelete: LeadListProps['onDelete'] }) {
  const { open: menuOpen, toggle, close, anchor } = usePopover()
  const href = siteHref(lead)
  const discarded = lead.stage === 'discarded'
  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    close()
    fn()
  }
  return (
    <div className="popover-anchor" ref={anchor} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="icon-btn quiet" aria-label={`Más acciones para ${lead.title}`} aria-expanded={menuOpen} onClick={toggle}>
        <MoreHorizontal aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="popover align-end row-menu" role="menu">
          {lead.mapsUrl && (
            <a className="menu-item" role="menuitem" href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
              <MapPin aria-hidden="true" />
              <span className="grow">Ver en Google Maps</span>
            </a>
          )}
          {href && (
            <a className="menu-item" role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={close}>
              <ExternalLink aria-hidden="true" />
              <span className="grow">Abrir su sitio</span>
            </a>
          )}
          {lead.siteKind === 'web' && (
            <button type="button" className="menu-item" role="menuitem" onClick={run(() => onAction(lead, 'recheck'))}>
              <RefreshCw aria-hidden="true" />
              <span className="grow">Revisar de nuevo</span>
            </button>
          )}
          {(lead.stage === 'site_ok' || lead.stage === 'unverified') && (
            <button type="button" className="menu-item" role="menuitem" onClick={run(() => onAction(lead, 'promote'))}>
              <Sparkles aria-hidden="true" />
              <span className="grow">Marcar como candidato</span>
            </button>
          )}
          <button type="button" className="menu-item" role="menuitem" onClick={run(() => onAction(lead, discarded ? 'restore' : 'discard'))}>
            {discarded ? <RotateCcw aria-hidden="true" /> : <Ban aria-hidden="true" />}
            <span className="grow">{discarded ? 'Devolver al embudo' : 'Descartar'}</span>
          </button>
          <div className="menu-sep" />
          <button type="button" className="menu-item danger" role="menuitem" onClick={run(() => onDelete(lead))}>
            <Trash2 aria-hidden="true" />
            <span className="grow">Eliminar</span>
          </button>
        </div>
      )}
    </div>
  )
}

/** Lista de negocios sobre el campo de niebla: por qué cada uno necesita un sitio nuevo y cómo escribirle. */
export default function LeadList({
  leads,
  loading,
  filtered,
  showBase = false,
  activeId,
  page,
  pages,
  total,
  onPage,
  onOpen,
  onHover,
  onAction,
  onDelete,
  emptyTitle,
  emptyText,
}: LeadListProps) {
  if (loading && leads.length === 0) {
    return (
      <div className="leads" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="lead-row" style={{ cursor: 'default' }} aria-hidden="true">
            <div className="skeleton" style={{ width: 40, height: 20 }} />
            <div>
              <div className="skeleton" style={{ width: '70%', height: 15 }} />
              <div className="skeleton" style={{ width: '45%', height: 12, marginTop: 8 }} />
            </div>
            <div className="skeleton" style={{ width: '80%', height: 14 }} />
            <div className="skeleton" style={{ width: '90%', height: 14 }} />
            <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="leads">
        <div className="leads-empty">
          <h3>{emptyTitle ?? (filtered ? 'Nada en este filtro' : 'Todavía no hay negocios')}</h3>
          <p>
            {emptyText ??
              (filtered
                ? 'Prueba con otro estado del campo o espera a que termine la revisión de sitios.'
                : 'Cuando la búsqueda termine, aquí aparecerán sus negocios con lo que encontró la revisión.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="leads">
      <div className="lead-head" aria-hidden="true">
        <span className="label">Oport.</span>
        <span className="label">Negocio</span>
        <span className="label">Sitio</span>
        <span className="label">Por qué</span>
        <span className="label">Contacto</span>
        <span className="label col-google">Google</span>
        <span />
      </div>
      {leads.map((lead) => {
        const domain = displayDomain(lead)
        const href = siteHref(lead)
        const all = findings(lead)
        const sub = showBase && lead.job ? lead.job.name || `${lead.job.niche} · ${lead.job.zone}` : [lead.category, lead.city].filter(Boolean).join(' · ')
        return (
          <div
            key={lead.id}
            className={`lead-row${lead.id === activeId ? ' is-active' : ''}${lead.stage === 'discarded' ? ' is-muted' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`Abrir la ficha de ${lead.title}`}
            onClick={() => onOpen(lead)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(lead)
              }
            }}
            onPointerEnter={() => onHover?.(lead.id)}
            onPointerLeave={() => onHover?.(null)}
          >
            <Score lead={lead} />
            <div className="lead-ident" style={{ minWidth: 0 }}>
              <div className="lead-name">{lead.title}</div>
              <div className="lead-sub">{sub || '—'}</div>
            </div>
            <div className="lead-site">
              {href && lead.siteKind === 'web' && domain && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="lead-domain" onClick={(e) => e.stopPropagation()}>
                  {domain}
                </a>
              )}
              <SiteChip lead={lead} />
            </div>
            <div className="lead-whybox" style={{ minWidth: 0 }}>
              <div className={`lead-why${all.length === 0 ? ' is-quiet' : ''}`}>{whyLine(lead)}</div>
              {all.length > 1 && <div className="lead-why-more">y {all.length - 1} hallazgo{all.length - 1 === 1 ? '' : 's'} más</div>}
            </div>
            <div className="lead-contact">
              <WhatsAppButton lead={lead} />
            </div>
            <div className="lead-google">
              {lead.rating ? (
                <>
                  <Star className="star" aria-hidden="true" /> {lead.rating.toFixed(1)}
                  {lead.reviewsCount ? <span style={{ color: 'var(--ink-3)' }}> · {lead.reviewsCount}</span> : null}
                </>
              ) : (
                <span style={{ color: 'var(--ink-3)' }}>—</span>
              )}
            </div>
            <div className="lead-actions">
              <RowMenu lead={lead} onAction={onAction} onDelete={onDelete} />
            </div>
          </div>
        )
      })}
      {pages > 1 && (
        <div className="pager">
          <span>
            {((page - 1) * 100 + 1).toLocaleString('es-MX')}–{Math.min(page * 100, total).toLocaleString('es-MX')} de{' '}
            {total.toLocaleString('es-MX')}
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Anterior
            </button>
            <button type="button" className="btn btn-light btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
              Siguiente
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

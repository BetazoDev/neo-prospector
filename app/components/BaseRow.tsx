'use client'

import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import DotField, { describeDots } from './DotField'
import { countDots } from '@/lib/pipeline/dots'

export interface FieldBase {
  id: number
  name: string | null
  niche: string
  zone: string
  status: string
  leadsFound: number
  createdAt: string
  error: string | null
  total: number
  dots: string
  hidden: number
}

export function baseTitle(base: { name: string | null; niche: string; zone: string }): string {
  return base.name || `${base.niche} · ${base.zone}`
}

export function timeAgo(date: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(date).getTime()) / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  return new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

interface BaseRowProps {
  base: FieldBase
  now: number
  /** "feature": el campo ocupa todo el ancho, para que la base se lea como un campo y no como una fila. */
  variant?: 'feature' | 'compact'
  dotSize?: 'sm' | 'md' | 'lg'
  onRename?: (base: FieldBase) => void
  onDelete?: (base: FieldBase) => void
}

/** Una base como fila: nombre, su campo de puntos y cuántos candidatos dejó. */
export default function BaseRow({ base, now, onRename, onDelete, variant = 'compact', dotSize = 'md' }: BaseRowProps) {
  const counts = countDots(base.dots)
  const candidates = counts.c ?? 0
  const checking = (counts.r ?? 0) + (counts.p ?? 0)
  const scraping = base.status === 'running' || base.status === 'importing'
  const title = baseTitle(base)

  let state: React.ReactNode
  if (scraping) {
    state = (
      <span className="is-live">
        <span className="live-dot" aria-hidden="true" />
        {base.status === 'importing' ? 'Guardando resultados' : 'Buscando en Google Maps'}
      </span>
    )
  } else if (base.status === 'error') {
    state = <span className="is-error">{base.error ?? 'La búsqueda falló'}</span>
  } else if (checking > 0) {
    state = (
      <span className="is-live">
        <span className="live-dot" aria-hidden="true" />
        Revisando sitios
      </span>
    )
  }

  return (
    <Link href={`/bases/${base.id}`} className={`base-row${variant === 'feature' ? ' is-feature' : ''}`} aria-label={`${title}: ${candidates} candidatos`}>
      <div>
        <div className="base-row-title">{title}</div>
        <div className="base-row-meta">
          <span>{base.total.toLocaleString('es-MX')} negocios</span>
          <span>{timeAgo(base.createdAt, now)}</span>
          {state}
        </div>
      </div>

      <div className="base-row-dots">
        {scraping && base.total === 0 ? (
          <div className="base-row-scraping" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="dot dot-p" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <DotField dots={base.dots} hidden={base.hidden} size={dotSize} label={describeDots(base.dots)} />
        )}
      </div>

      <div className="base-row-count">
        <span className={`num ${candidates === 0 ? 'is-zero' : ''}`}>{candidates.toLocaleString('es-MX')}</span>
        <span className="label">candidato{candidates === 1 ? '' : 's'}</span>
      </div>

      {(onRename || onDelete) && (
        <div className="base-row-actions" onClick={(e) => e.preventDefault()}>
          {onRename && (
            <button type="button" className="icon-btn quiet" aria-label={`Renombrar ${title}`} onClick={() => onRename(base)}>
              <Pencil aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button type="button" className="icon-btn quiet" aria-label={`Eliminar ${title}`} onClick={() => onDelete(base)}>
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </Link>
  )
}

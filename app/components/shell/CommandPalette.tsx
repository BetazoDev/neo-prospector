'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CornerDownLeft, Layers, Plus, Search, Upload, Workflow } from 'lucide-react'
import { DOT_STATES, dotState } from '@/lib/pipeline/dots'
import type { RecentBase } from './shell-types'

interface LeadHit {
  id: number
  jobId: number
  title: string
  domain: string | null
  city: string | null
  stage: string
  checkState: string | null
  siteScore: number | null
  job?: { name: string | null; niche: string; zone: string }
}

interface BaseHit {
  id: number
  name: string | null
  niche: string
  zone: string
}

type Row =
  | { kind: 'action'; id: string; label: string; icon: React.ReactNode; run: () => void }
  | { kind: 'base'; id: string; label: string; meta: string; run: () => void }
  | { kind: 'lead'; id: string; label: string; meta: string; dot: string; run: () => void }

interface CommandPaletteProps {
  recent: RecentBase[]
  onClose: () => void
  onImport: () => void
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Búsqueda global: negocios de todas las bases, bases y acciones, desde el teclado. */
export default function CommandPalette({ recent, onClose, onImport }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [leads, setLeads] = useState<LeadHit[]>([])
  const [bases, setBases] = useState<BaseHit[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
    fetch('/api/jobs')
      .then((res) => (res.ok ? res.json() : []))
      .then((jobs: BaseHit[]) => setBases(jobs))
      .catch(() => undefined)
  }, [])

  // Los negocios se buscan en el servidor; con menos de dos letras no vale la pena.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ jobId: 'all', search: q, limit: '8', sort: 'score' })
        const res = await fetch(`/api/leads?${params}`, { signal: controller.signal })
        if (res.ok) setLeads((await res.json()).leads)
      } catch {
        // Una búsqueda cancelada por la siguiente tecla no es un error.
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  const rows = useMemo<Row[]>(() => {
    const q = fold(query.trim())
    const actions = ([
      { kind: 'action', id: 'new', label: 'Nueva búsqueda en Google Maps', icon: <Plus aria-hidden="true" />, run: () => go('/?nueva=1') },
      { kind: 'action', id: 'candidates', label: 'Ver candidatos de todas las bases', icon: <Workflow aria-hidden="true" />, run: () => go('/embudo?etapa=candidatos') },
      { kind: 'action', id: 'import', label: 'Importar un CSV', icon: <Upload aria-hidden="true" />, run: () => { onClose(); onImport() } },
    ] as Row[]).filter((a) => !q || fold(a.label).includes(q))

    const baseRows: Row[] = (q
      ? bases.filter((b) => fold(`${b.name ?? ''} ${b.niche} ${b.zone}`).includes(q)).slice(0, 5)
      : recent.slice(0, 5).map((r) => ({ id: r.id, name: r.name, niche: '', zone: '' }))
    ).map((b) => ({
      kind: 'base' as const,
      id: `base-${b.id}`,
      label: b.name || `${b.niche} · ${b.zone}`,
      meta: q ? '' : `${recent.find((r) => r.id === b.id)?.candidates ?? 0} candidatos`,
      run: () => go(`/bases/${b.id}`),
    }))

    const leadRows: Row[] = (q.length >= 2 ? leads : []).map((l) => ({
      kind: 'lead' as const,
      id: `lead-${l.id}`,
      label: l.title,
      meta: [l.domain, l.job?.name || (l.job ? `${l.job.niche} · ${l.job.zone}` : null)].filter(Boolean).join(' · '),
      dot: dotState(l),
      run: () => go(`/bases/${l.jobId}?negocio=${l.id}`),
    }))

    return [...leadRows, ...baseRows, ...actions]
    // go y onImport cambian en cada render pero solo cierran y navegan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, leads, bases, recent])

  const selected = Math.min(cursor, Math.max(rows.length - 1, 0))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rows[selected]?.run()
    }
  }

  const groups: { title: string; kind: Row['kind'] }[] = [
    { title: 'Negocios', kind: 'lead' },
    { title: query.trim() ? 'Bases' : 'Bases recientes', kind: 'base' },
    { title: 'Acciones', kind: 'action' },
  ]

  return (
    <div className="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar en todo" onKeyDown={onKeyDown}>
        <div className="palette-input">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
              if (e.target.value.trim().length < 2) setLeads([])
            }}
            placeholder="Busca un negocio, dominio, teléfono o base"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={rows[selected] ? `pal-${rows[selected].id}` : undefined}
          />
          {loading && <span className="label">Buscando…</span>}
        </div>
        <div className="palette-results" id="palette-results" role="listbox">
          {rows.length === 0 && (
            <div className="palette-empty">
              Nada coincide con «{query.trim()}». Prueba con el dominio o los últimos dígitos del teléfono.
            </div>
          )}
          {groups.map((group) => {
            const items = rows.filter((r) => r.kind === group.kind)
            if (items.length === 0) return null
            return (
              <div key={group.kind}>
                <div className="palette-group label">{group.title}</div>
                {items.map((row) => {
                  const index = rows.indexOf(row)
                  return (
                    <button
                      key={row.id}
                      id={`pal-${row.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === selected}
                      className="menu-item palette-row"
                      onMouseMove={() => setCursor(index)}
                      onClick={row.run}
                    >
                      {row.kind === 'action' && row.icon}
                      {row.kind === 'base' && <Layers aria-hidden="true" />}
                      {row.kind === 'lead' && <span className={`dot dot-${row.dot}`} aria-label={DOT_STATES[row.dot as keyof typeof DOT_STATES]?.label} />}
                      <span className="grow">{row.label}</span>
                      {row.kind !== 'action' && row.meta && <span className="meta">{row.meta}</span>}
                      {index === selected && <ArrowRight aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> moverse
          </span>
          <span>
            <span className="kbd">
              <CornerDownLeft aria-hidden="true" style={{ width: 12, height: 12 }} />
            </span>{' '}
            abrir
          </span>
          <span>
            <span className="kbd">esc</span> cerrar
          </span>
        </div>
      </div>
    </div>
  )
}

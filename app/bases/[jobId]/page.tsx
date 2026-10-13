'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Download, Pencil, Phone, Search, Trash2, X } from 'lucide-react'
import AppShell, { useShell } from '../../components/shell/AppShell'
import DotField, { describeDots } from '../../components/DotField'
import LeadList from '../../components/LeadList'
import LeadDrawer from '../../components/LeadDrawer'
import { timeAgo } from '../../components/BaseRow'
import { EMPTY_STATS, type Lead, type LeadAction, type LeadStats } from '../../components/lead-types'
import { buildLeadsCsv, downloadCsv } from '@/lib/export-csv'
import { countDots, type DotState } from '@/lib/pipeline/dots'
import type { Segment } from '@/lib/pipeline/stages'

interface BaseInfo {
  id: number
  name: string | null
  niche: string
  zone: string
  status: string
  createdAt: string
  error: string | null
  dots: string
  items: { id: number; t: string }[]
}

interface CheckProgress {
  total: number
  pending: number
  running: number
  done: number
  failed: number
  stages: Record<string, number>
}

/** Cada estado del campo es también un filtro de la lista. */
const LEGEND: { segment: Segment; states: DotState[]; label: string }[] = [
  { segment: 'candidates', states: ['c'], label: 'Candidatos' },
  { segment: 'preparing', states: ['w'], label: 'Preparando demo' },
  { segment: 'published', states: ['d'], label: 'Demo lista' },
  { segment: 'outreach', states: ['k'], label: 'En contacto' },
  { segment: 'unverified', states: ['u'], label: 'Revisión manual' },
  { segment: 'site_ok', states: ['o'], label: 'Sitio aceptable' },
  { segment: 'no_site', states: ['n'], label: 'Sin sitio propio' },
  { segment: 'pending', states: ['p', 'r'], label: 'Por revisar' },
  { segment: 'discarded', states: ['x'], label: 'Descartados' },
]

const ACTION_TOAST: Record<LeadAction, [string, string]> = {
  discard: ['Descartado', 'Ya no aparece entre los candidatos.'],
  restore: ['De vuelta en el embudo', 'Recuperó la etapa que le toca según su revisión.'],
  recheck: ['Revisando de nuevo', 'El sitio volvió a la cola de revisión.'],
  promote: ['Marcado como candidato', 'Queda listo para preparar su demo.'],
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function BaseDetail({ jobId }: { jobId: number }) {
  const router = useRouter()
  const { data: shellData, toast, refresh: refreshShell } = useShell()

  const [base, setBase] = useState<BaseInfo | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [progress, setProgress] = useState<CheckProgress | null>(null)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('score')
  const [segment, setSegment] = useState<Segment>('all')
  const [withPhone, setWithPhone] = useState(false)

  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const loadBase = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline/fields?jobId=${jobId}&detail=1`)
      if (res.status === 401) return router.push('/login')
      if (res.ok) {
        const { bases } = await res.json()
        if (bases[0]) setBase(bases[0])
        else router.push('/bases')
      }
    } catch {
      // Lo intenta el siguiente refresco.
    }
  }, [jobId, router])

  const query = useCallback(
    (p: number, limit: number) =>
      new URLSearchParams({ page: String(p), sort, search, segment, withPhone: String(withPhone), jobId: String(jobId), limit: String(limit) }),
    [jobId, sort, search, segment, withPhone]
  )

  const loadLeads = useCallback(
    async (p = 1, { quiet = false } = {}) => {
      if (!quiet) setLoading(true)
      try {
        const res = await fetch(`/api/leads?${query(p, 100)}`)
        if (res.status === 401) return router.push('/login')
        const data = await res.json()
        setLeads(data.leads)
        setStats(data.stats)
        setTotal(data.total)
        setPages(data.pages)
        setPage(p)
        // La ficha abierta se actualiza con lo último que se sabe del negocio.
        setOpenLead((current) => (current ? (data.leads.find((l: Lead) => l.id === current.id) ?? current) : current))
      } catch {
        // Lo intenta el siguiente refresco.
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [query, router]
  )

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline/check?jobId=${jobId}`)
      if (res.ok) setProgress(await res.json())
    } catch {
      // Lo intenta el siguiente refresco.
    }
  }, [jobId])

  // El bucle de revisión necesita las versiones más recientes sin reiniciarse con cada filtro.
  const refreshAll = useRef(() => {})
  useEffect(() => {
    refreshAll.current = () => {
      loadBase()
      loadLeads(page, { quiet: true })
    }
  }, [loadBase, loadLeads, page])

  useEffect(() => {
    const first = setTimeout(() => {
      loadBase()
      loadProgress()
    }, 0)
    // Desde la búsqueda global o un punto de otra pantalla: ?negocio=123 abre su ficha.
    const target = Number(new URLSearchParams(window.location.search).get('negocio'))
    if (target) {
      fetch(`/api/leads?id=${target}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data?.lead && setOpenLead(data.lead))
        .catch(() => undefined)
    }
    return () => clearTimeout(first)
  }, [loadBase, loadProgress])

  useEffect(() => {
    const timer = setTimeout(() => loadLeads(1), 250)
    return () => clearTimeout(timer)
  }, [loadLeads])

  const checking = !!progress && progress.pending + progress.running > 0
  const scraping = base?.status === 'running' || base?.status === 'importing'

  // Mientras queden sitios por revisar, la pantalla empuja la cola lote por lote y el campo se
  // va llenando. Si la revisión de fondo ya los tomó, solo espera y refresca.
  useEffect(() => {
    if (!checking) return
    let cancelled = false
    let lastRefresh = 0
    const run = async () => {
      while (!cancelled) {
        let data: CheckProgress
        try {
          const res = await fetch(`/api/pipeline/check?jobId=${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
          if (!res.ok) break
          data = await res.json()
        } catch {
          await wait(4000)
          continue
        }
        if (cancelled) break
        setProgress(data)
        const finished = data.pending + data.running === 0
        if (finished || Date.now() - lastRefresh > 2500) {
          lastRefresh = Date.now()
          refreshAll.current()
        }
        if (finished) {
          refreshShell()
          break
        }
        await wait(data.pending === 0 ? 2500 : 400)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [checking, jobId, refreshShell])

  // Si la revisión de esta base arrancó en otro lado (la de fondo tras importar, otro vendedor),
  // la barra lo anuncia en su actividad y la pantalla se suma al bucle para ver el campo llenarse.
  const announced = !!shellData?.activity.some((a) => a.kind === 'checks' && a.jobId === jobId)
  useEffect(() => {
    if (!announced || checking) return
    const timer = setTimeout(loadProgress, 0)
    return () => clearTimeout(timer)
  }, [announced, checking, loadProgress])

  // Una base que todavía se extrae de Google Maps se refresca hasta que llegan sus negocios.
  useEffect(() => {
    if (!scraping) return
    const timer = setInterval(() => {
      loadBase()
      loadProgress()
    }, 5000)
    return () => clearInterval(timer)
  }, [scraping, loadBase, loadProgress])

  const startChecks = async (retryFailed = false) => {
    const res = await fetch(`/api/pipeline/check?jobId=${jobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retryFailed }),
    }).catch(() => null)
    if (res?.ok) {
      setProgress(await res.json())
      refreshAll.current()
    } else toast('No se pudo iniciar la revisión', 'Intenta de nuevo en un momento.', 'error')
  }

  const handleAction = async (lead: Lead, action: LeadAction) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/leads?id=${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return toast('No se pudo', data.error ?? 'Intenta de nuevo.', 'error')
      const updated: Lead = { ...lead, ...data.lead }
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      setOpenLead((current) => (current?.id === updated.id ? updated : current))
      toast(...ACTION_TOAST[action])
      loadBase()
      loadProgress()
      refreshShell()
    } catch {
      toast('No se pudo actualizar', 'Revisa tu conexión.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`¿Eliminar a ${lead.title} de esta base?`)) return
    const res = await fetch(`/api/leads?id=${lead.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) return toast('No se pudo eliminar', 'Intenta de nuevo.', 'error')
    toast('Eliminado', lead.title)
    if (openLead?.id === lead.id) setOpenLead(null)
    loadBase()
    loadLeads(page, { quiet: true })
    refreshShell()
  }

  const deleteBase = async () => {
    if (!base || !window.confirm(`¿Eliminar esta base y sus ${base.dots.length} negocios? No se puede deshacer.`)) return
    const res = await fetch(`/api/jobs?id=${jobId}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) {
      refreshShell()
      router.push('/bases')
    } else toast('No se pudo eliminar la base', 'Intenta de nuevo.', 'error')
  }

  const saveName = async () => {
    const name = nameDraft.trim()
    if (!name) return setEditing(false)
    const res = await fetch(`/api/jobs?id=${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => null)
    if (res?.ok) {
      setEditing(false)
      loadBase()
      refreshShell()
    } else toast('No se pudo renombrar', 'Intenta de nuevo.', 'error')
  }

  const exportCsv = async () => {
    const res = await fetch(`/api/leads?${query(1, 10000)}`).catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    if (!data.leads?.length) return toast('Nada que exportar', 'Este filtro no tiene negocios.', 'error')
    downloadCsv(buildLeadsCsv(data.leads), `base-${jobId}-${segment}-${new Date().toISOString().split('T')[0]}.csv`)
    toast('CSV descargado', `${data.leads.length} negocios del filtro actual.`)
  }

  const openById = async (id: number) => {
    const inList = leads.find((l) => l.id === id)
    if (inList) return setOpenLead(inList)
    const res = await fetch(`/api/leads?id=${id}`).catch(() => null)
    if (res?.ok) setOpenLead((await res.json()).lead)
  }

  const closeDrawer = useCallback(() => {
    setOpenLead(null)
    if (window.location.search.includes('negocio=')) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const openIndex = openLead ? leads.findIndex((l) => l.id === openLead.id) : -1
  const step = useCallback(
    (delta: number) => {
      const next = leads[openIndex + delta]
      if (openIndex >= 0 && next) setOpenLead(next)
    },
    [leads, openIndex]
  )

  const counts = useMemo(() => countDots(base?.dots ?? ''), [base?.dots])
  const activeLegend = LEGEND.find((l) => l.segment === segment)
  const title = base ? base.name || `${base.niche} · ${base.zone}` : ''
  const queue = progress ? progress.done + progress.pending + progress.running + progress.failed : 0
  const unclassified = progress?.stages.new ?? 0

  return (
    <>
      <section className="field-carbon">
        <div className="page page-head">
          <nav className="crumbs" aria-label="Ruta">
            <Link href="/bases">Bases</Link>
            <ChevronRight aria-hidden="true" />
            <span>{title || '…'}</span>
          </nav>

          <div className="page-title-row">
            <div style={{ minWidth: 0, flex: '1 1 480px' }}>
              {editing ? (
                <form
                  style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 640 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveName()
                  }}
                >
                  <input className="input" style={{ height: 48, fontSize: 20 }} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus aria-label="Nombre de la base" />
                  <button type="submit" className="icon-btn" aria-label="Guardar nombre">
                    <Check aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => setEditing(false)}>
                    <X aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <h1 className="display page-title">
                    {title || ' '}
                    {base && base.dots.length > 0 && (
                      <span className="dim">
                        {(counts.c ?? 0).toLocaleString('es-MX')} candidato{counts.c === 1 ? '' : 's'} de {base.dots.length.toLocaleString('es-MX')}
                      </span>
                    )}
                  </h1>
                  {base && (
                    <button
                      type="button"
                      className="icon-btn quiet"
                      style={{ marginTop: 'calc((min(max(32px, 3.6vw), 48px) - 36px) / 2)' }}
                      aria-label="Renombrar la base"
                      onClick={() => {
                        setNameDraft(title)
                        setEditing(true)
                      }}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              {base && (
                <div className="page-meta">
                  {base.niche && base.niche !== 'CSV Import' && (
                    <span>
                      Giro <strong>{base.niche}</strong>
                    </span>
                  )}
                  {base.zone && (
                    <span>
                      Zona <strong>{base.zone}</strong>
                    </span>
                  )}
                  <span>{timeAgo(base.createdAt)}</span>
                  <span>
                    <strong>{stats.withWebsite.toLocaleString('es-MX')}</strong> con sitio propio
                  </span>
                  <span>
                    <strong>{stats.withWhatsapp.toLocaleString('es-MX')}</strong> con WhatsApp en su sitio
                  </span>
                </div>
              )}
            </div>
            <div className="page-actions">
              <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={total === 0}>
                <Download aria-hidden="true" /> Exportar CSV
              </button>
              <button type="button" className="icon-btn" onClick={deleteBase} aria-label="Eliminar la base">
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </div>

          {scraping ? (
            <div className="status-line" role="status">
              <span className="live-dot" aria-hidden="true" />
              <span>
                <strong>Buscando en Google Maps.</strong> Los negocios aparecen aquí en cuanto termina la extracción.
              </span>
            </div>
          ) : checking ? (
            <div className="status-line" role="status">
              <span className="live-dot" aria-hidden="true" />
              <span>
                Revisando sitios: <strong>{progress!.done.toLocaleString('es-MX')}</strong> de <strong>{queue.toLocaleString('es-MX')}</strong>.
                Sigue en el servidor aunque cierres esta pantalla.
              </span>
              <span className="status-bar" aria-hidden="true">
                <span style={{ transform: `scaleX(${queue ? Math.max(progress!.done / queue, 0.02) : 0})` }} />
              </span>
            </div>
          ) : unclassified > 0 ? (
            <div className="status-line">
              <span>
                <strong>{unclassified.toLocaleString('es-MX')} negocios</strong> llegaron antes de la revisión automática.
              </span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => startChecks()}>
                Revisar sus sitios
              </button>
            </div>
          ) : progress && progress.failed > 0 ? (
            <div className="status-line">
              <span>
                <strong>{progress.failed.toLocaleString('es-MX')} sitios</strong> no se pudieron revisar por un error del servidor.
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => startChecks(true)}>
                Reintentar
              </button>
            </div>
          ) : null}

          {base && base.dots.length > 0 && (
            <div className="base-field">
              <DotField
                dots={base.dots}
                items={base.items}
                size="lg"
                label={describeDots(base.dots)}
                activeId={hoverId ?? openLead?.id ?? null}
                focus={activeLegend ? activeLegend.states.join('') : null}
                onPick={openById}
                onHover={setHoverId}
              />
              <div className="legend" role="group" aria-label="Filtrar por estado">
                <button type="button" className="legend-item" aria-pressed={segment === 'all'} onClick={() => setSegment('all')}>
                  <span className="num">{base.dots.length.toLocaleString('es-MX')}</span>
                  Todos
                </button>
                {LEGEND.map((item) => {
                  const n = item.states.reduce((sum, s) => sum + (counts[s] ?? 0), 0)
                  if (n === 0 && segment !== item.segment) return null
                  return (
                    <button
                      key={item.segment}
                      type="button"
                      className="legend-item"
                      aria-pressed={segment === item.segment}
                      onClick={() => setSegment(segment === item.segment ? 'all' : item.segment)}
                    >
                      <span className={`dot dot-${item.states[0]}`} aria-hidden="true" />
                      <span className="num">{n.toLocaleString('es-MX')}</span>
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="field-niebla work">
        <div className="page">
          <div className="toolbar">
            <div className="search-box">
              <Search aria-hidden="true" />
              <input
                className="input"
                type="search"
                placeholder="Buscar negocio, ciudad o dominio"
                aria-label="Buscar en esta base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
              <option value="score">Mejor oportunidad</option>
              <option value="reviews">Más reseñas</option>
              <option value="rating">Mayor calificación</option>
              <option value="newest">Más recientes</option>
            </select>
            <button type="button" className="toggle-chip" aria-pressed={withPhone} onClick={() => setWithPhone(!withPhone)}>
              <Phone aria-hidden="true" /> Con teléfono
            </button>
            <span className="count-note">
              {total.toLocaleString('es-MX')} {total === 1 ? 'negocio' : 'negocios'}
              {activeLegend ? ` · ${activeLegend.label.toLowerCase()}` : ''}
            </span>
          </div>

          <LeadList
            leads={leads}
            loading={loading}
            filtered={stats.total > 0}
            activeId={hoverId ?? openLead?.id ?? null}
            page={page}
            pages={pages}
            total={total}
            onPage={(p) => {
              loadLeads(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onOpen={setOpenLead}
            onHover={setHoverId}
            onAction={handleAction}
            onDelete={handleDelete}
          />
        </div>
      </section>

      <LeadDrawer
        lead={openLead}
        onClose={closeDrawer}
        onAction={handleAction}
        busy={busy}
        position={openIndex >= 0 ? { index: openIndex, total: leads.length } : null}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </>
  )
}

interface PageProps {
  params: Promise<{ jobId: string }>
}

export default function BaseDetailPage({ params }: PageProps) {
  const { jobId } = use(params)
  return (
    <AppShell active="bases">
      <BaseDetail jobId={parseInt(jobId)} />
    </AppShell>
  )
}

'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import AppShell, { useShell } from '../components/shell/AppShell'
import LeadList from '../components/LeadList'
import LeadDrawer from '../components/LeadDrawer'
import type { Lead, LeadAction } from '../components/lead-types'
import { RAIL_STAGES, stageCount } from '../components/shell/shell-types'
import { useHydrated } from '../components/shell/useHydrated'

const COPY: Record<string, { title: string; text: string }> = {
  candidatos: {
    title: 'Ningún candidato todavía',
    text: 'Cuando la revisión encuentre sitios caídos, viejos o sin versión para celular, sus negocios aparecen aquí, de todas tus bases.',
  },
  revision: { title: 'Nada para revisar a mano', text: 'Aquí llegan los sitios que bloquean la revisión automática.' },
  preparando: { title: 'Ninguna demo en preparación', text: 'La investigación y la construcción de demos llegan en la siguiente fase del Prospector.' },
  demo: { title: 'Ninguna demo lista', text: 'Las demos publicadas aparecerán aquí, listas para enviar por WhatsApp.' },
  contactados: { title: 'Nadie contactado todavía', text: 'Los negocios a los que ya escribiste aparecerán aquí para darles seguimiento.' },
  respondieron: { title: 'Sin respuestas todavía', text: 'Cuando un negocio responda, lo verás aquí.' },
  clientes: { title: 'Sin clientes todavía', text: 'Los negocios que contraten aparecerán aquí.' },
}

const ACTION_TOAST: Record<LeadAction, [string, string]> = {
  discard: ['Descartado', 'Ya no aparece en esta etapa.'],
  restore: ['De vuelta en el embudo', 'Recuperó la etapa que le toca según su revisión.'],
  recheck: ['Revisando de nuevo', 'El sitio volvió a la cola de revisión.'],
  promote: ['Marcado como candidato', 'Queda listo para preparar su demo.'],
}

function Funnel() {
  const router = useRouter()
  const params = useSearchParams()
  const { data, toast, refresh: refreshShell } = useShell()
  const slug = RAIL_STAGES.some((r) => r.slug === params.get('etapa')) ? params.get('etapa')! : 'candidatos'
  const rail = RAIL_STAGES.find((r) => r.slug === slug)!

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (p = 1, { quiet = false } = {}) => {
      if (!quiet) setLoading(true)
      try {
        const q = new URLSearchParams({ jobId: 'all', segment: rail.segment, sort: 'score', search, page: String(p), limit: '100' })
        const res = await fetch(`/api/leads?${q}`)
        if (res.status === 401) return router.push('/login')
        const json = await res.json()
        setLeads(json.leads)
        setTotal(json.total)
        setPages(json.pages)
        setPage(p)
      } catch {
        // Lo intenta el siguiente refresco.
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [rail.segment, search, router]
  )

  useEffect(() => {
    const timer = setTimeout(() => load(1), 200)
    return () => clearTimeout(timer)
  }, [load])

  const handleAction = async (lead: Lead, action: LeadAction) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/leads?id=${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return toast('No se pudo', json.error ?? 'Intenta de nuevo.', 'error')
      const updated: Lead = { ...lead, ...json.lead }
      setOpenLead((current) => (current?.id === updated.id ? updated : current))
      toast(...ACTION_TOAST[action])
      load(page, { quiet: true })
      refreshShell()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(`¿Eliminar a ${lead.title}?`)) return
    const res = await fetch(`/api/leads?id=${lead.id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) return toast('No se pudo eliminar', 'Intenta de nuevo.', 'error')
    if (openLead?.id === lead.id) setOpenLead(null)
    load(page, { quiet: true })
    refreshShell()
  }

  const openIndex = openLead ? leads.findIndex((l) => l.id === openLead.id) : -1
  const hydrated = useHydrated()
  const stages = hydrated ? (data?.stages ?? {}) : {}
  const copy = COPY[slug]

  return (
    <>
      <section className="field-carbon">
        <div className="page page-head">
          <h1 className="display page-title">
            {rail.label}
            <span className="dim">de todas tus bases</span>
          </h1>
          <p className="page-meta">
            <span>
              <strong>{hydrated ? stageCount(stages, rail).toLocaleString('es-MX') : '–'}</strong> {stageCount(stages, rail) === 1 ? 'negocio' : 'negocios'} en esta etapa
            </span>
          </p>
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
                placeholder="Buscar negocio, ciudad, dominio o teléfono"
                aria-label="Buscar en esta etapa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="count-note">
              {total.toLocaleString('es-MX')} {total === 1 ? 'negocio' : 'negocios'} · mejor oportunidad primero
            </span>
          </div>
          <LeadList
            leads={leads}
            loading={loading}
            filtered={!!search.trim()}
            showBase
            activeId={openLead?.id ?? null}
            page={page}
            pages={pages}
            total={total}
            onPage={(p) => {
              load(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onOpen={setOpenLead}
            onAction={handleAction}
            onDelete={handleDelete}
            emptyTitle={search.trim() ? undefined : copy?.title}
            emptyText={search.trim() ? undefined : copy?.text}
          />
        </div>
      </section>

      <LeadDrawer
        lead={openLead}
        onClose={() => setOpenLead(null)}
        onAction={handleAction}
        busy={busy}
        showBase
        position={openIndex >= 0 ? { index: openIndex, total: leads.length } : null}
        onPrev={() => openIndex > 0 && setOpenLead(leads[openIndex - 1])}
        onNext={() => openIndex >= 0 && openIndex < leads.length - 1 && setOpenLead(leads[openIndex + 1])}
      />
    </>
  )
}

export default function FunnelPage() {
  return (
    <AppShell active="embudo">
      <Suspense fallback={null}>
        <Funnel />
      </Suspense>
    </AppShell>
  )
}

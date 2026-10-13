'use client'

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Download, House, Layers, LogOut, Search, Settings, Upload, Workflow } from 'lucide-react'
import { HemeronLogo } from '../HemeronLogo'
import SettingsModal from '../SettingsModal'
import ImportCSVModal from '../ImportCSVModal'
import CommandPalette from './CommandPalette'
import { usePopover } from './usePopover'
import { useHydrated } from './useHydrated'
import { useNow } from './useNow'
import { DEMO_STEP_LABEL, RAIL_STAGES, stageCount, type Activity, type DemoQueue, type ShellData } from './shell-types'
import { buildLeadsCsv, downloadCsv } from '@/lib/export-csv'

export type NavKey = 'inicio' | 'bases' | 'embudo'

interface Toast {
  id: number
  title: string
  desc?: string
  type: 'success' | 'error'
}

interface ShellContextValue {
  data: ShellData | null
  refresh: () => void
  toast: (title: string, desc?: string, type?: 'success' | 'error') => void
  openImport: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext)
  if (!value) throw new Error('useShell fuera de AppShell')
  return value
}

const EMPTY: ShellData = { stages: {}, recent: [], activity: [] }
const BUSY_POLL_MS = 4000
const IDLE_POLL_MS = 20000

function activityLabel(activity: Activity[]): string {
  if (activity.length === 0) return 'Sin tareas'
  if (activity.length > 1) return `${activity.length} tareas en curso`
  const only = activity[0]
  if (only.kind === 'scrape') return 'Buscando en Google Maps'
  if (only.kind === 'demo') return `Preparando demo · ${only.name}`
  return `Revisando sitios · ${only.done} de ${only.total}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/** Estado del worker de la Mac: si está en línea, si pausó (límite del plan o sin sesión), cuántas demos esperan. */
function WorkerLine({ demos }: { demos?: DemoQueue }) {
  const now = useNow()
  if (!demos) return null
  const { worker, queued } = demos
  const paused = worker.pausedUntil && new Date(worker.pausedUntil).getTime() > now
  return (
    <div className={`worker-line ${worker.online ? (paused ? 'is-paused' : 'is-online') : 'is-offline'}`}>
      <span className="worker-dot" aria-hidden="true" />
      <span className="grow">
        {worker.online
          ? paused
            ? worker.pauseReason === 'auth'
              ? 'Claude no tiene sesión en la Mac: genera el token con claude setup-token'
              : `La Mac pausó hasta las ${formatTime(worker.pausedUntil!)} por el límite del plan`
            : `Mac en línea · hasta ${worker.capacity} demos a la vez`
          : 'La Mac está fuera de línea: las demos esperan en cola'}
      </span>
      {queued > 0 && <span className="meta">{queued} en cola</span>}
    </div>
  )
}

function ActivityMenu({ activity, demos }: { activity: Activity[]; demos?: DemoQueue }) {
  const { open: menuOpen, toggle, close, anchor } = usePopover()
  const busy = activity.length > 0
  return (
    <div className="popover-anchor activity-anchor" ref={anchor}>
      <button
        type="button"
        className={`activity-pill ${busy ? 'is-busy' : ''}`}
        onClick={toggle}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
      >
        <span className="activity-dot" aria-hidden="true" />
        <span>{activityLabel(activity)}</span>
      </button>
      {menuOpen && (
        <div className="popover align-end" role="dialog" aria-label="Actividad en curso">
          <div className="popover-head">
            <span className="popover-title">Actividad</span>
            <span className="label">{busy ? 'En vivo' : 'En reposo'}</span>
          </div>
          <WorkerLine demos={demos} />
          {!busy && (
            <p className="activity-empty">
              Aquí aparecen las búsquedas, las revisiones de sitios y las demos mientras corren. Siguen aunque cierres la pantalla.
            </p>
          )}
          {activity.map((item) => (
            <Link
              key={`${item.kind}-${item.kind === 'demo' ? item.leadId : item.jobId}`}
              href={item.kind === 'demo' ? `/bases/${item.jobId}?negocio=${item.leadId}` : `/bases/${item.jobId}`}
              className="activity-item"
              onClick={close}
            >
              <span className="activity-kind">
                <span className="live-dot" aria-hidden="true" />
                {item.kind === 'scrape' ? 'Buscando en Google Maps' : item.kind === 'demo' ? 'Preparando demo' : 'Revisando sitios'}
              </span>
              <div className="activity-name">{item.name}</div>
              {item.kind === 'checks' && (
                <>
                  <div className="activity-meta">
                    {item.done} de {item.total} sitios revisados
                  </div>
                  <div className="activity-bar" aria-hidden="true">
                    <span style={{ transform: `scaleX(${item.total ? Math.max(item.done / item.total, 0.03) : 0})` }} />
                  </div>
                </>
              )}
              {item.kind === 'scrape' && (
                <div className="activity-meta">{item.status === 'importing' ? 'Guardando resultados' : 'Extrayendo negocios'}</div>
              )}
              {item.kind === 'demo' && <div className="activity-meta">{item.step ? DEMO_STEP_LABEL[item.step] : 'Empezando'}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function BasesMenu({ data, active }: { data: ShellData; active: boolean }) {
  const { open: menuOpen, toggle, close, anchor } = usePopover()
  return (
    <div className="popover-anchor" ref={anchor}>
      <button type="button" onClick={toggle} aria-expanded={menuOpen} aria-current={active ? 'page' : undefined}>
        Bases <ChevronDown aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="popover align-start" role="menu" aria-label="Bases recientes">
          <div className="popover-head">
            <span className="popover-title">Recientes</span>
            <span className="label">Candidatos</span>
          </div>
          {data.recent.length === 0 && <p className="activity-empty">Todavía no hay bases. Lanza una búsqueda desde el inicio.</p>}
          {data.recent.map((base) => (
            <Link key={base.id} href={`/bases/${base.id}`} className="menu-item" role="menuitem" onClick={close}>
              {base.checking || base.status === 'running' || base.status === 'importing' ? (
                <span className="live-dot" aria-label="En curso" />
              ) : (
                <Layers aria-hidden="true" />
              )}
              <span className="grow">{base.name}</span>
              <span className="count">{base.candidates}</span>
            </Link>
          ))}
          <div className="menu-sep" />
          <Link href="/bases" className="menu-item" role="menuitem" onClick={close}>
            <span className="grow">Ver todas las bases</span>
          </Link>
        </div>
      )}
    </div>
  )
}

function AccountMenu({
  email,
  onImport,
  onSettings,
  onExport,
  onLogout,
}: {
  email: string | null
  onImport: () => void
  onSettings: () => void
  onExport: () => void
  onLogout: () => void
}) {
  const { open: menuOpen, toggle, close, anchor } = usePopover()
  const run = (fn: () => void) => () => {
    close()
    fn()
  }
  return (
    <div className="popover-anchor" ref={anchor}>
      <button type="button" className="account-btn" onClick={toggle} aria-expanded={menuOpen} aria-label="Cuenta y herramientas">
        {email ? email[0].toUpperCase() : ''}
      </button>
      {menuOpen && (
        <div className="popover align-end" role="menu" style={{ width: 280 }}>
          {email && (
            <div className="popover-head">
              <span className="activity-meta" style={{ marginTop: 0 }}>{email}</span>
            </div>
          )}
          <button type="button" className="menu-item" role="menuitem" onClick={run(onImport)}>
            <Upload aria-hidden="true" />
            <span className="grow">Importar CSV</span>
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(onExport)}>
            <Download aria-hidden="true" />
            <span className="grow">Exportar todo a CSV</span>
          </button>
          <button type="button" className="menu-item" role="menuitem" onClick={run(onSettings)}>
            <Settings aria-hidden="true" />
            <span className="grow">Configuración</span>
          </button>
          <div className="menu-sep" />
          <button type="button" className="menu-item danger" role="menuitem" onClick={run(onLogout)}>
            <LogOut aria-hidden="true" />
            <span className="grow">Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  )
}

function StageRail({ stages: live }: { stages: Record<string, number> }) {
  const hydrated = useHydrated()
  const stages = hydrated ? live : {}
  const pathname = usePathname()
  const params = useSearchParams()
  const current = pathname === '/embudo' ? (params.get('etapa') ?? 'candidatos') : null
  return (
    <nav className="stage-rail" aria-label="Etapas del embudo">
      {RAIL_STAGES.map((rail) => {
        const count = stageCount(stages, rail)
        const hot = 'hot' in rail && rail.hot && count > 0
        return (
          <Link
            key={rail.slug}
            href={`/embudo?etapa=${rail.slug}`}
            className={`stage-link ${count === 0 ? 'is-zero' : ''} ${hot ? 'is-hot' : ''}`}
            aria-current={current === rail.slug ? 'page' : undefined}
          >
            <span className="num">{count.toLocaleString('es-MX')}</span>
            <span className="stage-name">{rail.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function AppShell({ active, children }: { active: NavKey; children: ReactNode }) {
  const router = useRouter()
  const [data, setData] = useState<ShellData | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [email, setEmail] = useState<string | null>(null)
  const toastId = useRef(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setEmail(me?.user?.email ?? me?.email ?? null))
      .catch(() => undefined)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/shell')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) setData(await res.json())
    } catch {
      // Sin red la barra se queda con lo último que supo; el siguiente sondeo lo corrige.
    }
  }, [router])

  // La barra se refresca seguido mientras hay trabajo de fondo y en calma cuando no.
  const busy = (data?.activity.length ?? 0) > 0
  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const timer = setInterval(refresh, busy ? BUSY_POLL_MS : IDLE_POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [refresh, busy])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toast = useCallback((title: string, desc?: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev.slice(-2), { id, title, desc, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200)
  }, [])

  const exportAll = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=10000&jobId=all')
      if (!res.ok) return
      const { leads } = await res.json()
      if (!leads?.length) {
        toast('Sin prospectos', 'Todavía no hay nada que exportar.', 'error')
        return
      }
      downloadCsv(buildLeadsCsv(leads, { withSearch: true }), `hemeron-prospectos-${new Date().toISOString().split('T')[0]}.csv`)
      toast('Exportación lista', `Se descargaron ${leads.length.toLocaleString('es-MX')} prospectos.`)
    } catch {
      toast('No se pudo exportar', 'Revisa tu conexión e intenta de nuevo.', 'error')
    }
  }, [toast])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    router.push('/login')
    router.refresh()
  }, [router])

  const shell = data ?? EMPTY
  const totalLeads = Object.values(shell.stages).reduce((a, b) => a + b, 0)
  const context = useMemo<ShellContextValue>(
    () => ({ data, refresh, toast, openImport: () => setImportOpen(true) }),
    [data, refresh, toast]
  )

  return (
    <ShellContext.Provider value={context}>
      <header className="shell-head">
        <div className="page topbar">
          <Link href="/" className="brand" aria-label="Hemeron Prospector, inicio">
            <HemeronLogo className="brand-logo" />
            <span className="brand-product">Prospector</span>
          </Link>
          <nav className="mainnav" aria-label="Principal">
            <Link href="/" aria-current={active === 'inicio' ? 'page' : undefined}>
              Inicio
            </Link>
            <BasesMenu data={shell} active={active === 'bases'} />
            <Link href="/embudo" aria-current={active === 'embudo' ? 'page' : undefined}>
              Embudo
            </Link>
          </nav>
          <div className="topbar-end">
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Buscar en todo">
              <Search aria-hidden="true" />
              <span className="search-text">Buscar negocio, dominio o teléfono</span>
              <span className="kbd">⌘K</span>
            </button>
            <ActivityMenu activity={shell.activity} demos={shell.demos} />
            <AccountMenu
              email={email}
              onImport={() => setImportOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              onExport={exportAll}
              onLogout={logout}
            />
          </div>
        </div>
        <div className="page">
          {/* El riel lee la etapa de la URL; sin Suspense, Next no puede prerenderizar la página. */}
          <Suspense fallback={<nav className="stage-rail" aria-label="Etapas del embudo" />}>
            <StageRail stages={shell.stages} />
          </Suspense>
        </div>
      </header>

      <main className="shell-main">{children}</main>

      <nav className="mobile-nav" aria-label="Principal">
        <Link href="/" aria-current={active === 'inicio' ? 'page' : undefined}>
          <House aria-hidden="true" />
          Inicio
        </Link>
        <Link href="/bases" aria-current={active === 'bases' ? 'page' : undefined}>
          <Layers aria-hidden="true" />
          Bases
        </Link>
        <Link href="/embudo" aria-current={active === 'embudo' ? 'page' : undefined}>
          <Workflow aria-hidden="true" />
          Embudo
        </Link>
        <button type="button" onClick={() => setPaletteOpen(true)}>
          <Search aria-hidden="true" />
          Buscar
        </button>
      </nav>

      {paletteOpen && (
        <CommandPalette
          recent={shell.recent}
          onClose={() => setPaletteOpen(false)}
          onImport={() => setImportOpen(true)}
        />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} totalLeads={totalLeads} onExportCSV={exportAll} />
      <ImportCSVModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(jobId) => {
          toast('CSV importado', 'La base ya está lista y sus sitios se están revisando.')
          refresh()
          if (jobId) router.push(`/bases/${jobId}`)
        }}
      />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <span className="toast-mark" aria-hidden="true" />
            <div>
              <div className="toast-title">{t.title}</div>
              {t.desc && <div className="toast-desc">{t.desc}</div>}
            </div>
          </div>
        ))}
      </div>
    </ShellContext.Provider>
  )
}

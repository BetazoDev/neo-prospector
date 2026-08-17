'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar, { NavItem } from '../../components/Sidebar'
import FilterBar from '../../components/FilterBar'
import LeadsTable from '../../components/LeadsTable'
import SettingsModal from '../../components/SettingsModal'

interface Lead {
  id: number
  title: string
  phone: string | null
  rating: number | null
  reviewsCount: number | null
  category: string | null
  address: string | null
  city: string | null
  website: string | null
  mapsUrl: string | null
  searchNiche: string | null
  searchZone: string | null
  createdAt: string
}

interface Stats {
  total: number
  withPhone: number
  avgRating: number | null
  totalReviews: number | null
}

interface ScrapingJob {
  id: number
  name?: string | null
  niche: string
  zone: string
  status: string
  leadsFound: number
  createdAt: string
}

interface PageProps {
  params: Promise<{ jobId: string }>
}

export default function BaseDetailPage({ params }: PageProps) {
  const { jobId: rawJobId } = use(params)
  const jobId = parseInt(rawJobId)
  const router = useRouter()

  const [job, setJob] = useState<ScrapingJob | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, withPhone: 0, avgRating: null, totalReviews: null })
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [withPhone, setWithPhone] = useState(false)
  const [view, setView] = useState<'table' | 'grid'>('table')

  // Modals & Nav
  const [activeNav, setActiveNav] = useState<NavItem>('leads')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameText, setEditNameText] = useState('')

  // Toast
  const [toast, setToast] = useState<{ title: string; desc: string; type: 'success' | 'error' } | null>(null)

  const showToast = (title: string, desc: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, desc, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch job info
  const fetchJobInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      if (res.ok) {
        const jobs: ScrapingJob[] = await res.json()
        const found = jobs.find((j) => j.id === jobId)
        if (found) {
          setJob(found)
          setEditNameText(found.name || `${found.niche} · ${found.zone}`)
        }
      }
    } catch (err) {
      console.error('Error fetching job info:', err)
    }
  }, [jobId])

  // Fetch leads for this job
  const fetchLeads = useCallback(
    async (p = 1) => {
      setLoading(true)
      try {
        const paramsQuery = new URLSearchParams({
          page: String(p),
          sort,
          search,
          withPhone: String(withPhone),
          jobId: String(jobId),
          limit: '100',
        })
        const res = await fetch(`/api/leads?${paramsQuery}`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        setLeads(data.leads)
        setStats(data.stats)
        setTotal(data.total)
        setPages(data.pages)
        setPage(p)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [jobId, sort, search, withPhone, router]
  )

  useEffect(() => {
    fetchJobInfo()
  }, [fetchJobInfo])

  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(1), 300)
    return () => clearTimeout(timer)
  }, [fetchLeads])

  const handleDeleteLead = async (id: number) => {
    try {
      await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
      showToast('Lead eliminado', 'El prospecto fue removido')
      fetchLeads(page)
    } catch {
      showToast('Error', 'No se pudo eliminar el prospecto', 'error')
    }
  }

  const handleDeleteBase = async () => {
    if (!confirm('¿Estás seguro de eliminar esta base y todos sus prospectos?')) return
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Base eliminada', 'La base fue removida correctamente')
        router.push('/')
      }
    } catch {
      showToast('Error', 'No se pudo eliminar la base', 'error')
    }
  }

  const handleSaveName = async () => {
    if (!editNameText.trim()) return
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameText.trim() }),
      })
      if (res.ok) {
        setIsEditingName(false)
        fetchJobInfo()
        showToast('Nombre actualizado', 'La base se renombró correctamente')
      }
    } catch {
      showToast('Error', 'No se pudo actualizar el nombre', 'error')
    }
  }

  const handleExportCSV = () => {
    if (leads.length === 0) return
    const headers = [
      'ID',
      'Empresa',
      'Categoría',
      'Teléfono',
      'Rating',
      'Reseñas',
      'Ciudad',
      'Dirección',
      'Sitio Web',
      'Google Maps',
    ]
    const rows = leads.map((l) => [
      l.id,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${(l.category ?? '').replace(/"/g, '""')}"`,
      `"${l.phone ?? ''}"`,
      l.rating ?? '',
      l.reviewsCount ?? '',
      `"${(l.city ?? '').replace(/"/g, '""')}"`,
      `"${(l.address ?? '').replace(/"/g, '""')}"`,
      `"${l.website ?? ''}"`,
      `"${l.mapsUrl ?? ''}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `base-${jobId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Exportación completada', 'Se descargó el CSV de la base')
  }

  const handleNavigate = (nav: NavItem) => {
    if (nav === 'dashboard') {
      router.push('/')
    } else if (nav === 'settings') {
      setIsSettingsOpen(true)
    } else if (nav === 'agent') {
      router.push('/#agent-section')
    }
  }

  return (
    <>
      <Sidebar
        activeNav={activeNav}
        onNavigate={handleNavigate}
        mobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push('/')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ← <span className="desktop-only-hide">Volver a Bases</span>
            </button>

            <div className="topbar-title" style={{ gap: 8 }}>
              <div className="topbar-accent-bar" />
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    className="form-input"
                    value={editNameText}
                    onChange={(e) => setEditNameText(e.target.value)}
                    style={{ height: 32, fontSize: 14 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleSaveName}>
                    Guardar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingName(false)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{job?.name || (job ? `${job.niche} · ${job.zone}` : `Base #${jobId}`)}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditingName(true)}
                    title="Editar nombre"
                    style={{ padding: '2px 6px', fontSize: 12 }}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportCSV} disabled={leads.length === 0}>
              📥 CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleDeleteBase} style={{ color: '#ef4444' }}>
              🗑️ Eliminar Base
            </button>
          </div>
        </div>

        <div className="page-container">
          {/* Base Stats Header */}
          <div className="base-header-card">
            <div className="base-header-main">
              <h1 className="base-header-title">
                {job?.name || (job ? `${job.niche} · ${job.zone}` : `Base #${jobId}`)}
              </h1>
              {job && (
                <p className="base-header-meta">
                  Nicho: <strong>{job.niche}</strong> · Zona: <strong>{job.zone}</strong>
                </p>
              )}
            </div>

            <div className="base-header-stats">
              <div className="mini-stat">
                <span className="mini-stat-val">{stats.total}</span>
                <span className="mini-stat-lbl">Prospectos</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-val">{stats.withPhone}</span>
                <span className="mini-stat-lbl">Con Teléfono</span>
              </div>
              <div className="mini-stat">
                <span className="mini-stat-val">
                  {stats.avgRating ? `★ ${stats.avgRating.toFixed(1)}` : 'N/A'}
                </span>
                <span className="mini-stat-lbl">Rating Prom.</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            withPhone={withPhone}
            onWithPhoneChange={setWithPhone}
            view={view}
            onViewChange={setView}
            total={total}
          />

          {/* Leads Table / Grid */}
          <LeadsTable
            leads={leads}
            view={view}
            total={total}
            page={page}
            pages={pages}
            onPageChange={fetchLeads}
            onDelete={handleDeleteLead}
            loading={loading}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        totalLeads={stats.total}
        onExportCSV={handleExportCSV}
      />

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <div>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-desc">{toast.desc}</div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .base-header-card {
          background: var(--bg-surface, #141414);
          border: 1px solid var(--border-default, #222222);
          border-radius: var(--radius-lg, 12px);
          padding: 20px 24px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .base-header-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.4px;
        }

        .base-header-meta {
          font-size: 13px;
          color: var(--text-tertiary, #888888);
          margin-top: 4px;
        }

        .base-header-stats {
          display: flex;
          gap: 24px;
        }

        .mini-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .mini-stat-val {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .mini-stat-lbl {
          font-size: 11px;
          color: var(--text-tertiary, #888888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </>
  )
}

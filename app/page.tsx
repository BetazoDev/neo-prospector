'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar, { NavItem } from './components/Sidebar'
import StatsPanel from './components/StatsPanel'
import AIAgentForm from './components/AIAgentForm'
import SearchTabs, { JobTab } from './components/SearchTabs'
import FilterBar from './components/FilterBar'
import LeadsTable from './components/LeadsTable'
import SettingsModal from './components/SettingsModal'

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

interface ApiResponse {
  leads: Lead[]
  total: number
  page: number
  pages: number
  stats: Stats
}

export default function DashboardPage() {
  const router = useRouter()

  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, withPhone: 0, avgRating: null, totalReviews: null })
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // Search Jobs / Airtable Tabs State
  const [jobs, setJobs] = useState<JobTab[]>([])
  const [activeJobId, setActiveJobId] = useState<number | 'all'>('all')

  // Navigation & Modals
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [withPhone, setWithPhone] = useState(false)
  const [view, setView] = useState<'table' | 'grid'>('table')

  // Toast
  const [toast, setToast] = useState<{ title: string; desc: string; type: 'success' | 'error' } | null>(null)

  const showToast = (title: string, desc: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, desc, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch search jobs list
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
    }
  }, [])

  // Fetch leads for selected tab
  const fetchLeads = useCallback(
    async (p = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          sort,
          search,
          withPhone: String(withPhone),
          jobId: String(activeJobId),
          limit: '100',
        })
        const res = await fetch(`/api/leads?${params}`)
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data: ApiResponse = await res.json()
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
    [sort, search, withPhone, activeJobId, router]
  )

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Debounced search & tab change trigger
  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(1), 300)
    return () => clearTimeout(timer)
  }, [fetchLeads])

  const handleDeleteLead = async (id: number) => {
    try {
      await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
      showToast('Lead eliminado', 'El lead fue removido de la base de datos')
      fetchLeads(page)
      fetchJobs()
    } catch {
      showToast('Error', 'No se pudo eliminar el lead', 'error')
    }
  }

  const handleDeleteJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Búsqueda eliminada', 'Se removió la búsqueda y sus prospectos')
        if (activeJobId === jobId) {
          setActiveJobId('all')
        }
        fetchJobs()
        fetchLeads(1)
      }
    } catch {
      showToast('Error', 'No se pudo eliminar la búsqueda', 'error')
    }
  }

  const handleLeadsFound = () => {
    showToast('¡Prospección completada!', 'Se encontraron nuevos leads. Actualizando pestañas y tabla...')
    fetchJobs()
    setTimeout(() => fetchLeads(1), 500)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      router.push('/login')
    }
  }

  // Sidebar navigation handler
  const handleNavigate = (nav: NavItem) => {
    setActiveNav(nav)

    if (nav === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (nav === 'agent') {
      const el = document.getElementById('agent-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      const input = document.getElementById('niche-input') as HTMLInputElement
      if (input) input.focus()
    } else if (nav === 'leads') {
      const el = document.getElementById('leads-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else if (nav === 'settings') {
      setIsSettingsOpen(true)
    }
  }

  // Export to CSV
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
      'Nicho Búsqueda',
      'Zona Búsqueda',
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
      `"${l.searchNiche ?? ''}"`,
      `"${l.searchZone ?? ''}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `neo-prospector-leads-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Exportación iniciada', 'Se descargó el archivo CSV con tus leads')
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
        {/* Top bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="topbar-mobile-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
              </svg>
            </button>
            <div className="topbar-title">
              <div className="topbar-accent-bar" />
              Dashboard de Leads
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="desktop-only-hide" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              prospector.diabolicalservices.tech
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                fetchJobs()
                fetchLeads(page)
              }}
              title="Actualizar"
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
                <path d="M1 7A6 6 0 0 1 7 1c1.97 0 3.7.95 4.8 2.4M13 7A6 6 0 0 1 7 13c-1.97 0-3.7-.95-4.8-2.4" strokeLinecap="round" />
                <path d="M11 1v3h-3M3 13v-3h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="desktop-only-hide">Actualizar</span>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              title="Cerrar Sesión"
              style={{ color: '#ef4444' }}
            >
              <span className="desktop-only-hide">Cerrar Sesión</span>
              <svg className="topbar-mobile-btn" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13, display: 'inline' }}>
                <path d="M5 2H2v10h3M9 10l3-3-3-3M12 7H5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="page-container">
          {/* Stats */}
          <StatsPanel stats={stats} loading={loading && stats.total === 0} />

          {/* AI Agent Form */}
          <div id="agent-section">
            <AIAgentForm onLeadsFound={handleLeadsFound} />
          </div>

          {/* Search Tabs & Filter Bar & Leads Section */}
          <div id="leads-section">
            {/* Airtable-style Search Tabs */}
            <SearchTabs
              jobs={jobs}
              activeJobId={activeJobId}
              onSelectTab={(id) => setActiveJobId(id)}
              onDeleteJob={handleDeleteJob}
              totalLeadsCount={stats.total}
            />

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

            {/* Leads */}
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
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavigate('dashboard')}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
          </svg>
          Inicio
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${activeNav === 'agent' ? 'active' : ''}`}
          onClick={() => handleNavigate('agent')}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v12M2 8h12" strokeLinecap="round" />
          </svg>
          Prospectar
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${activeNav === 'leads' ? 'active' : ''}`}
          onClick={() => handleNavigate('leads')}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" />
          </svg>
          Leads
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
          onClick={() => handleNavigate('settings')}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
          </svg>
          Ajustes
        </button>
      </nav>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false)
          setActiveNav('dashboard')
        }}
        totalLeads={stats.total}
        onExportCSV={handleExportCSV}
      />

      {/* Toast */}
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
    </>
  )
}

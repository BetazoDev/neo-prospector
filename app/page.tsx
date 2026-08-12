'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar, { NavItem } from './components/Sidebar'
import StatsPanel from './components/StatsPanel'
import AIAgentForm from './components/AIAgentForm'
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
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, withPhone: 0, avgRating: null, totalReviews: null })
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // Navigation & Modals
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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

  const fetchLeads = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        sort,
        search,
        withPhone: String(withPhone),
        limit: '50',
      })
      const res = await fetch(`/api/leads?${params}`)
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
  }, [sort, search, withPhone])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(1), 300)
    return () => clearTimeout(timer)
  }, [fetchLeads])

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
      showToast('Lead eliminado', 'El lead fue removido de la base de datos')
      fetchLeads(page)
    } catch {
      showToast('Error', 'No se pudo eliminar el lead', 'error')
    }
  }

  const handleLeadsFound = () => {
    showToast('¡Prospección completada!', 'Se encontraron nuevos leads. Actualizando tabla...')
    setTimeout(() => fetchLeads(1), 500)
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
    const headers = ['ID', 'Empresa', 'Categoría', 'Teléfono', 'Rating', 'Reseñas', 'Ciudad', 'Dirección', 'Sitio Web', 'Google Maps']
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
    link.setAttribute('download', `neo-prospector-leads-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Exportación iniciada', 'Se descargó el archivo CSV con tus leads')
  }

  return (
    <>
      <Sidebar activeNav={activeNav} onNavigate={handleNavigate} />

      <main className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-title">
            <div className="topbar-accent-bar" />
            Dashboard de Leads
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              prospector.diabolicalservices.tech
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fetchLeads(page)}
              title="Actualizar"
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
                <path d="M1 7A6 6 0 0 1 7 1c1.97 0 3.7.95 4.8 2.4M13 7A6 6 0 0 1 7 13c-1.97 0-3.7-.95-4.8-2.4" strokeLinecap="round" />
                <path d="M11 1v3h-3M3 13v-3h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Actualizar
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

          {/* Filter Bar & Leads Section */}
          <div id="leads-section">
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
              onDelete={handleDelete}
              loading={loading}
            />
          </div>
        </div>
      </main>

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

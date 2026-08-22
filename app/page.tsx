'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar, { NavItem } from './components/Sidebar'
import StatsPanel from './components/StatsPanel'
import AIAgentForm from './components/AIAgentForm'
import BasesGrid, { JobBase } from './components/BasesGrid'
import SettingsModal from './components/SettingsModal'
import ImportCSVModal from './components/ImportCSVModal'

interface Stats {
  total: number
  withPhone: number
  avgRating: number | null
  totalReviews: number | null
}

export default function DashboardPage() {
  const router = useRouter()

  const [jobs, setJobs] = useState<JobBase[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, withPhone: 0, avgRating: null, totalReviews: null })
  const [loading, setLoading] = useState(true)

  // Navigation & Modals
  const [activeNav, setActiveNav] = useState<NavItem>('dashboard')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ title: string; desc: string; type: 'success' | 'error' } | null>(null)

  const showToast = (title: string, desc: string, type: 'success' | 'error' = 'success') => {
    setToast({ title, desc, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch jobs (bases)
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/jobs')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (res.ok) {
        const data: JobBase[] = await res.json()
        setJobs(data)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  // Fetch global stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=1')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    fetchStats()
  }, [fetchJobs, fetchStats])

  const handleDeleteJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Base eliminada', 'Se removió la base y todos sus prospectos')
        fetchJobs()
        fetchStats()
      }
    } catch {
      showToast('Error', 'No se pudo eliminar la base', 'error')
    }
  }

  const handleRenameJob = async (jobId: number, newName: string) => {
    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (res.ok) {
        showToast('Base renombrada', 'El nombre de la base ha sido actualizado')
        fetchJobs()
      }
    } catch {
      showToast('Error', 'No se pudo renombrar la base', 'error')
    }
  }

  const handleLeadsFound = () => {
    showToast('¡Prospección completada!', 'Se creó tu nueva base con los prospectos encontrados.')
    fetchJobs()
    fetchStats()
  }

  const handleCSVImported = () => {
    showToast('¡CSV importado!', 'Se creó una nueva base con los leads del archivo CSV.')
    fetchJobs()
    fetchStats()
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
      const el = document.getElementById('bases-section')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else if (nav === 'settings') {
      setIsSettingsOpen(true)
    }
  }

  const handleExportAllCSV = async () => {
    try {
      const res = await fetch('/api/leads?limit=10000')
      if (!res.ok) return
      const data = await res.json()
      const leads = data.leads

      if (!leads || leads.length === 0) {
        showToast('Sin leads', 'No hay prospectos para exportar', 'error')
        return
      }

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
        'Nicho',
        'Zona',
      ]
      const rows = leads.map((l: any) => [
        l.id,
        `"${(l.title || '').replace(/"/g, '""')}"`,
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

      const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `neo-prospector-todos-los-leads-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Exportación iniciada', 'Se descargaron todos los prospectos en CSV')
    } catch {
      showToast('Error', 'No se pudo exportar el CSV', 'error')
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
              Dashboard de Prospectos
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="desktop-only-hide" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              prospector.diabolicalservices.tech
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setIsImportOpen(true)}
              title="Importar CSV"
              id="import-csv-btn"
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
                <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 11h12" strokeLinecap="round" />
              </svg>
              <span className="desktop-only-hide">Importar CSV</span>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                fetchJobs()
                fetchStats()
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

          {/* Bases Grid (Airtable style) */}
          <div id="bases-section">
            <BasesGrid
              jobs={jobs}
              onDeleteJob={handleDeleteJob}
              onRenameJob={handleRenameJob}
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
          Bases
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
        onExportCSV={handleExportAllCSV}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={handleCSVImported}
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

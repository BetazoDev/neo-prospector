'use client'

export type NavItem = 'dashboard' | 'leads' | 'agent' | 'settings'

interface SidebarProps {
  activeNav: NavItem
  onNavigate: (nav: NavItem) => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function Sidebar({
  activeNav,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const handleNavClick = (nav: NavItem) => {
    onNavigate(nav)
    if (onCloseMobile) onCloseMobile()
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Mobile Header / Close button */}
        <div className="sidebar-mobile-header">
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menú Principal</div>
          <button type="button" className="sidebar-close-btn" onClick={onCloseMobile} aria-label="Cerrar menú">
            ✕
          </button>
        </div>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">NP</div>
          <div>
            <div className="sidebar-logo-text">NeoProspector</div>
            <div className="sidebar-logo-sub">by Diabolical</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label" style={{ marginTop: 0 }}>Principal</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
            Dashboard
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${activeNav === 'leads' ? 'active' : ''}`}
            onClick={() => handleNavClick('leads')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" />
            </svg>
            Todos los Leads
          </button>

          <div className="sidebar-section-label" style={{ marginTop: 20 }}>Herramientas</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeNav === 'agent' ? 'active' : ''}`}
            onClick={() => handleNavClick('agent')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="6" r="3" />
              <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round" />
            </svg>
            Agente IA de Prospección
          </button>

          <div className="sidebar-section-label" style={{ marginTop: 20 }}>Sistema</div>

          <button
            type="button"
            className={`sidebar-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
            </svg>
            Configuración
          </button>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{ marginBottom: 4 }}>v1.0.0</div>
          <div style={{ color: 'var(--text-tertiary)' }}>Diabolical Services © 2026</div>
        </div>
      </aside>
    </>
  )
}

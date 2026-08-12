'use client'

export default function Sidebar() {
  return (
    <aside className="sidebar">
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

        <a href="/" className="sidebar-nav-item active">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
          </svg>
          Dashboard
        </a>

        <a href="/" className="sidebar-nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" />
          </svg>
          Todos los Leads
        </a>

        <div className="sidebar-section-label" style={{ marginTop: 20 }}>Herramientas</div>

        <a href="/" className="sidebar-nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="6" r="3" />
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" strokeLinecap="round" />
          </svg>
          Agente IA
        </a>

        <a href="/" className="sidebar-nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v12M2 8h12" strokeLinecap="round" />
          </svg>
          Nueva Búsqueda
        </a>

        <div className="sidebar-section-label" style={{ marginTop: 20 }}>Sistema</div>

        <a href="/" className="sidebar-nav-item">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
          </svg>
          Configuración
        </a>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ marginBottom: 4 }}>v1.0.0</div>
        <div style={{ color: 'var(--text-tertiary)' }}>Diabolical Services © 2026</div>
      </div>
    </aside>
  )
}

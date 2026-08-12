'use client'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  totalLeads: number
  onExportCSV: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  totalLeads,
  onExportCSV,
}: SettingsModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '540px',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Configuración del Sistema</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Estado del motor de prospección y base de datos</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* System status cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {/* Apify status */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Apify Scraper Engine
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>Actor `compass/crawler-google-places`</div>
            </div>
            <span className="badge badge-success">Conectado</span>
          </div>

          {/* Database status */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Base de Datos
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>SQLite Relacional · {totalLeads} Leads</div>
            </div>
            <span className="badge badge-success">Activo</span>
          </div>

          {/* Dokploy / Domain info */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Dominio Productivo
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>prospector.diabolicalservices.tech</div>
            </div>
            <span className="badge badge-success">SSL Let's Encrypt</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onExportCSV} disabled={totalLeads === 0}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
              <path d="M7 1v8M7 9l-3-3M7 9l3-3M1 11h12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Exportar Leads (CSV)
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

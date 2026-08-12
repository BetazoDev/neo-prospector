'use client'

import { useState, useEffect } from 'react'

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
  const [apiKey, setApiKey] = useState('')
  const [maxLeads, setMaxLeads] = useState<number>(100)
  const [showKey, setShowKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load saved settings when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('neoprospector_settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.apiKey) setApiKey(parsed.apiKey)
          if (parsed.maxLeads) setMaxLeads(Number(parsed.maxLeads))
        }
      } catch {
        // ignore fallback
      }
    }
  }, [isOpen])

  const handleSaveSettings = () => {
    try {
      const settings = {
        apiKey: apiKey.trim(),
        maxLeads: Number(maxLeads) || 100,
      }
      localStorage.setItem('neoprospector_settings', JSON.stringify(settings))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      console.error('Error saving settings:', e)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Ajustes de prospección y estado del motor</div>
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

        {/* Prospecting Custom Settings Form */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8V6a4 4 0 1 0-8 0v2M3 8h10v6H3V8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Ajustes de Prospección (Persistente)
          </div>

          {/* API Key Field */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Apify API Key (Token)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="apify_api_... (opcional)"
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowKey(!showKey)}
                style={{ padding: '0 12px', fontSize: 12 }}
              >
                {showKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
              Si no especificas una clave, se utilizará la API Key por defecto del servidor.
            </div>
          </div>

          {/* Max Leads Select */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Límite de Prospectos a Extraer por Búsqueda
            </label>
            <select
              value={maxLeads}
              onChange={(e) => setMaxLeads(Number(e.target.value))}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value={20}>20 prospectos (Rápido)</option>
              <option value={50}>50 prospectos (Recomendado)</option>
              <option value={100}>100 prospectos (Estándar)</option>
              <option value={200}>200 prospectos (Extensivo)</option>
              <option value={500}>500 prospectos (Máxima cobertura)</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
              Esta preferencia se guardará en tu navegador y aplicará para todas las búsquedas.
            </div>
          </div>

          {/* Save Action */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600, opacity: saveSuccess ? 1 : 0, transition: 'opacity 0.2s' }}>
              ✓ ¡Ajustes guardados correctamente!
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveSettings}>
              Guardar Ajustes
            </button>
          </div>
        </div>

        {/* System status cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {/* Apify status */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Motor Apify Scraper
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>
                Actor `compass/crawler-google-places`
              </div>
            </div>
            <span className="badge badge-success">Conectado</span>
          </div>

          {/* Database status */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Base de Datos
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>SQLite Relacional · {totalLeads} Leads</div>
            </div>
            <span className="badge badge-success">Activo</span>
          </div>

          {/* Dominio Productivo */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Dominio Productivo
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>prospector.diabolicalservices.tech</div>
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

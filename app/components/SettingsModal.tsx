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
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState(false)
  const [maxLeads, setMaxLeads] = useState<number>(100)
  const [showKey, setShowKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Load saved settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setSaveSuccess(false)
      setSaveError('')
      try {
        const saved = localStorage.getItem('neoprospector_settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed.apiKey && parsed.apiKey.trim()) {
            setHasSavedKey(true)
            setApiKeyInput(parsed.apiKey.trim())
          } else {
            setHasSavedKey(false)
            setApiKeyInput('')
          }
          if (parsed.maxLeads) setMaxLeads(Number(parsed.maxLeads) || 100)
        }
      } catch {
        // fallback
      }
    }
  }, [isOpen])

  const handleSaveSettings = () => {
    setSaveError('')
    if (!apiKeyInput.trim()) {
      setSaveError('Por favor ingresa una API Key de Apify válida.')
      return
    }

    try {
      const settings = {
        apiKey: apiKeyInput.trim(),
        maxLeads: Math.max(1, Number(maxLeads) || 100),
      }
      localStorage.setItem('neoprospector_settings', JSON.stringify(settings))
      setHasSavedKey(true)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      console.error('Error saving settings:', e)
      setSaveError('No se pudo guardar la configuración en el navegador.')
    }
  }

  const handleClearApiKey = () => {
    localStorage.removeItem('neoprospector_settings')
    setApiKeyInput('')
    setHasSavedKey(false)
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Configuración del Sistema</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Ajustes de prospección y credenciales de Apify</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 16,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Prospecting Settings Form */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
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
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Apify API Key (Token) <span style={{ color: '#fff' }}>* Requerido</span>
              </label>
              <span className={`badge ${hasSavedKey ? 'badge-success' : 'badge-error'}`} style={{ fontSize: 10 }}>
                {hasSavedKey ? 'Configurada (Protegida)' : 'Requerida'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="ej. apify_api_bIBSldSBpL..."
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
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
              {hasSavedKey && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleClearApiKey}
                  style={{ padding: '0 10px', fontSize: 12, color: '#ef4444' }}
                  title="Borrar clave guardada"
                >
                  Borrar
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
              Esta API Key no se transmite ni se expone a terceros en respuestas JSON ni HTML.
            </div>
          </div>

          {/* Max Leads Input (Direct Number Entry) */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Número de Prospectos a Extraer por Búsqueda
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min="1"
                max="5000"
                value={maxLeads}
                onChange={(e) => setMaxLeads(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="ej. 50, 100, 250..."
                style={{
                  width: '140px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '9px 12px',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                prospectos por ejecución
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
              Escribe el número exacto de prospectos a extraer por cada búsqueda.
            </div>
          </div>

          {/* Messages & Actions */}
          {saveError && (
            <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 12, fontWeight: 600 }}>
              ⚠️ {saveError}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
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
            <span className={`badge ${hasSavedKey ? 'badge-success' : 'badge-error'}`}>
              {hasSavedKey ? 'Listo' : 'Requiere Key'}
            </span>
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

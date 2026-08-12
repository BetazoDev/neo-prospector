'use client'

import { useState } from 'react'

interface LogLine {
  text: string
  status: 'running' | 'done' | 'error'
}

interface AIAgentFormProps {
  onLeadsFound: () => void
}

export default function AIAgentForm({ onLeadsFound }: AIAgentFormProps) {
  const [niche, setNiche] = useState('')
  const [zone, setZone] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogLine[]>([])

  const addLog = (text: string, status: LogLine['status'] = 'running') => {
    setLogs((prev) => [...prev, { text, status }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!niche.trim() || !zone.trim() || loading) return

    setLoading(true)
    setLogs([])

    // Read stored settings for custom maxLeads and API key
    let maxLeads = 100
    let apiKey = ''
    try {
      const savedSettings = localStorage.getItem('neoprospector_settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        if (parsed.maxLeads) maxLeads = Number(parsed.maxLeads)
        if (parsed.apiKey) apiKey = parsed.apiKey.trim()
      }
    } catch {
      // fallback defaults
    }

    addLog(`Iniciando búsqueda: "${niche}" en "${zone}" (Límite: ${maxLeads} prospectos)...`)

    try {
      addLog('Geocodificando zona con OpenStreetMap...')

      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: niche.trim(),
          zone: zone.trim(),
          maxLeads,
          apiKey: apiKey || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        addLog(`Error: ${data.error}`, 'error')
        setLoading(false)
        return
      }

      addLog('Lanzando actor de Apify en Google Maps...')
      addLog('Esperando resultados de Google Maps...')
      addLog('Filtrando por zona geográfica...')
      addLog(`✓ ${data.count} leads encontrados y guardados`, 'done')

      onLeadsFound()
    } catch (err) {
      addLog(`Error de conexión: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-form-container">
      {/* Header */}
      <div className="agent-form-header">
        <div className="agent-icon">
          <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="9" cy="9" r="7" />
            <path d="M6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="agent-title">Agente de Prospección IA</div>
          <div className="agent-subtitle">
            Scraping inteligente de Google Maps via Apify — ingresa un nicho y zona para comenzar
          </div>
        </div>
        {loading && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#fff',
                display: 'inline-block',
                animation: 'pulse-dot 1s infinite',
              }}
            />
            Scraping en curso...
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="agent-form-body">
        <div className="form-field">
          <label className="form-label" htmlFor="niche-input">
            Nicho / Categoría
          </label>
          <input
            id="niche-input"
            type="text"
            className="form-input"
            placeholder="ej. Clínicas Dentales, Gimnasios, Restaurantes..."
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="zone-input">
            Zona / Ciudad
          </label>
          <input
            id="zone-input"
            type="text"
            className="form-input"
            placeholder="ej. Madrid, España · Buenos Aires · CDMX"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button
          id="launch-scraping-btn"
          type="submit"
          className="btn btn-primary"
          disabled={loading || !niche.trim() || !zone.trim()}
          style={{ height: '40px', alignSelf: 'flex-end', minWidth: 160 }}
        >
          {loading ? (
            <>
              <svg
                style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }}
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="7" cy="7" r="5" strokeOpacity="0.3" />
                <path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round" />
              </svg>
              Prospectando...
            </>
          ) : (
            <>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 14, height: 14 }}>
                <path d="M5 7H1M5 7l-2-2M5 7l-2 2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 1l1.5 1.5M7 1L8.5 2.5M13 7l-1.5 1.5M13 7l-1.5-1.5M7 13l-1.5-1.5M7 13l1.5-1.5M1 7l1.5-1.5M1 7l1.5 1.5" strokeLinecap="round" />
                <circle cx="7" cy="7" r="2.5" />
              </svg>
              Lanzar Búsqueda
            </>
          )}
        </button>
      </form>

      {/* Log output */}
      {logs.length > 0 && (
        <div className="scraping-log" id="scraping-log">
          {logs.map((line, i) => (
            <div key={i} className="log-line">
              <span className={`log-dot ${line.status}`} />
              <span className={`log-text ${line.status === 'done' ? 'done' : line.status === 'error' ? 'error' : ''}`}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

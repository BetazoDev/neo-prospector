'use client'

import { useEffect, useRef, useState } from 'react'

interface LogLine {
  text: string
  status: 'running' | 'done' | 'error'
}

interface AIAgentFormProps {
  onLeadsFound: () => void
  /** Se dispara en cuanto la base existe, para que el listado muestre "Extrayendo". */
  onJobStarted?: () => void
}

/** Cada cuánto le preguntamos al servidor por el estado real de la corrida. */
const POLL_INTERVAL_MS = 5000
/** A partir de aquí dejamos de vigilar; la base se sigue recuperando sola en el servidor. */
const MAX_WATCH_MS = 20 * 60 * 1000

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

export default function AIAgentForm({ onLeadsFound, onJobStarted }: AIAgentFormProps) {
  const [niche, setNiche] = useState('')
  const [zone, setZone] = useState('')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogLine[]>([])

  // Deja de sondear si el componente se desmonta a mitad de una búsqueda.
  const activeRef = useRef(true)
  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const addLog = (text: string, status: LogLine['status'] = 'running') => {
    setLogs((prev) => [...prev, { text, status }])
  }

  const replaceLastLog = (text: string, status: LogLine['status'] = 'running') => {
    setLogs((prev) => (prev.length === 0 ? [{ text, status }] : [...prev.slice(0, -1), { text, status }]))
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!niche.trim() || !zone.trim() || loading) return

    setLoading(true)
    setLogs([])
    addLog(`Lanzando búsqueda de "${niche.trim()}" en "${zone.trim()}"...`)

    let jobId: number
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: niche.trim(), zone: zone.trim() }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        replaceLastLog(data.error ?? `No se pudo lanzar la búsqueda (HTTP ${res.status})`, 'error')
        setLoading(false)
        return
      }

      jobId = data.jobId
      const zoneNote = data.countryCode ? `zona acotada a "${zone.trim()}" (${data.countryCode})` : `zona "${zone.trim()}"`
      replaceLastLog(`Corrida lanzada en Apify · ${zoneNote} · hasta ${data.maxLeads} lugares`, 'done')
      onJobStarted?.()
    } catch (err) {
      replaceLastLog(`Error de conexión: ${String(err)}`, 'error')
      setLoading(false)
      return
    }

    addLog('Extrayendo de Google Maps... 0s')

    const startedAt = Date.now()

    try {
      while (activeRef.current && Date.now() - startedAt < MAX_WATCH_MS) {
        await wait(POLL_INTERVAL_MS)
        if (!activeRef.current) return

        const res = await fetch(`/api/jobs/${jobId}/sync`, { method: 'POST' })
        if (!res.ok) {
          // Un fallo puntual de red no invalida la corrida: seguimos vigilando.
          replaceLastLog(
            `Extrayendo de Google Maps... ${formatElapsed(Date.now() - startedAt)} (sin respuesta del servidor)`
          )
          continue
        }

        const { outcome } = await res.json()

        if (outcome.state === 'done') {
          replaceLastLog(`✓ ${outcome.count} leads encontrados y guardados`, 'done')
          onLeadsFound()
          return
        }

        if (outcome.state === 'error') {
          replaceLastLog(outcome.message ?? 'La búsqueda terminó con error', 'error')
          return
        }

        const label = outcome.state === 'busy' ? 'Guardando resultados' : 'Extrayendo de Google Maps'
        replaceLastLog(`${label}... ${formatElapsed(Date.now() - startedAt)}`)
      }

      if (activeRef.current) {
        replaceLastLog(
          'La búsqueda tarda más de lo habitual. Sigue corriendo en Apify y la base se completará sola: vuelve a este panel en unos minutos.',
          'done'
        )
      }
    } catch (err) {
      if (activeRef.current) replaceLastLog(`Error de conexión: ${String(err)}`, 'error')
    } finally {
      if (activeRef.current) setLoading(false)
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
            maxLength={120}
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
            placeholder="ej. Jalisco, México · Madrid, España · Buenos Aires"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            disabled={loading}
            maxLength={120}
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

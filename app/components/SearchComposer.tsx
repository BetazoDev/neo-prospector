'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CircleAlert } from 'lucide-react'

/** Cada cuánto le preguntamos al servidor por el estado real de la corrida. */
const POLL_INTERVAL_MS = 5000
/** A partir de aquí dejamos de vigilar; la base se sigue recuperando sola en el servidor. */
const MAX_WATCH_MS = 20 * 60 * 1000

const EXAMPLES = [
  { niche: 'Dentistas', zone: 'Querétaro, México' },
  { niche: 'Gimnasios', zone: 'Aguascalientes, México' },
  { niche: 'Contadores', zone: 'León, Guanajuato' },
]

type StepState = 'running' | 'done' | 'error'

interface Step {
  text: string
  state: StepState
}

interface Run {
  jobId: number | null
  title: string
  state: StepState
  steps: Step[]
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes === 0 ? `${seconds} s` : `${minutes} min ${String(seconds).padStart(2, '0')} s`
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface SearchComposerHandle {
  focus: () => void
}

interface SearchComposerProps {
  maxLeads: number | null
  /** La base existe en el servidor: la lista de bases ya puede mostrarla. */
  onStarted: () => void
  /** Los negocios quedaron guardados y su revisión arrancó. */
  onFinished: () => void
  onImport: () => void
}

/**
 * Buscador del inicio: giro y zona. Lanza la corrida en Apify y la sigue paso a paso hasta
 * que los negocios quedan guardados; la revisión de sitios continúa sola en el servidor.
 */
const SearchComposer = forwardRef<SearchComposerHandle, SearchComposerProps>(function SearchComposer(
  { maxLeads, onStarted, onFinished, onImport },
  ref
) {
  const [niche, setNiche] = useState('')
  const [zone, setZone] = useState('')
  const [run, setRun] = useState<Run | null>(null)
  const nicheRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef(true)

  useImperativeHandle(ref, () => ({ focus: () => nicheRef.current?.focus() }), [])

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const running = run?.state === 'running'

  const setStep = (index: number, step: Step) =>
    setRun((prev) => (prev ? { ...prev, steps: [...prev.steps.slice(0, index), step, ...prev.steps.slice(index + 1)] } : prev))
  const finish = (state: StepState) => setRun((prev) => (prev ? { ...prev, state } : prev))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = niche.trim()
    const z = zone.trim()
    if (running) return
    // El botón siempre está activo: si falta un dato, lleva el cursor a ese campo.
    if (!n) return nicheRef.current?.focus()
    if (!z) return zoneRef.current?.focus()

    setRun({ jobId: null, title: `${n} · ${z}`, state: 'running', steps: [{ text: 'Lanzando la búsqueda en Google Maps', state: 'running' }] })

    let jobId: number
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: n, zone: z }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStep(0, { text: data.error ?? `No se pudo lanzar la búsqueda (HTTP ${res.status})`, state: 'error' })
        finish('error')
        return
      }
      jobId = data.jobId
      setRun((prev) => (prev ? { ...prev, jobId } : prev))
      const scope = data.countryCode ? `${z} (${String(data.countryCode).toUpperCase()})` : z
      setStep(0, { text: `Búsqueda lanzada en ${scope}, hasta ${data.maxLeads} negocios`, state: 'done' })
      onStarted()
    } catch (err) {
      setStep(0, { text: `Sin conexión con el servidor: ${String(err)}`, state: 'error' })
      finish('error')
      return
    }

    setRun((prev) => (prev ? { ...prev, steps: [...prev.steps, { text: 'Extrayendo negocios de Google Maps', state: 'running' }] } : prev))
    const startedAt = Date.now()

    try {
      while (activeRef.current && Date.now() - startedAt < MAX_WATCH_MS) {
        await wait(POLL_INTERVAL_MS)
        if (!activeRef.current) return
        const res = await fetch(`/api/jobs/${jobId}/sync`, { method: 'POST' })
        if (!res.ok) {
          // Un fallo puntual de red no invalida la corrida: seguimos vigilando.
          setStep(1, { text: `Extrayendo negocios de Google Maps · ${formatElapsed(Date.now() - startedAt)} (reintentando)`, state: 'running' })
          continue
        }
        const { outcome } = await res.json()
        if (outcome.state === 'done') {
          setStep(1, { text: `${outcome.count} negocios encontrados y guardados`, state: 'done' })
          setRun((prev) =>
            prev ? { ...prev, state: 'done', steps: [...prev.steps, { text: 'La revisión de sus sitios ya empezó', state: 'done' }] } : prev
          )
          onFinished()
          return
        }
        if (outcome.state === 'error') {
          setStep(1, { text: outcome.message ?? 'La búsqueda terminó con error', state: 'error' })
          finish('error')
          return
        }
        const label = outcome.state === 'busy' ? 'Guardando resultados' : 'Extrayendo negocios de Google Maps'
        setStep(1, { text: `${label} · ${formatElapsed(Date.now() - startedAt)}`, state: 'running' })
      }
      if (activeRef.current) {
        setStep(1, { text: 'Tarda más de lo habitual. Sigue en Apify y la base se completará sola.', state: 'done' })
        finish('done')
      }
    } catch (err) {
      if (activeRef.current) {
        setStep(1, { text: `Sin conexión con el servidor: ${String(err)}`, state: 'error' })
        finish('error')
      }
    }
  }

  return (
    <div>
      <form className="composer" onSubmit={handleSubmit}>
        <label className="box-field">
          <span className="label">Giro</span>
          <input
            ref={nicheRef}
            id="niche-input"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Dentistas, gimnasios, notarías…"
            maxLength={120}
            autoComplete="off"
            disabled={running}
          />
        </label>
        <label className="box-field">
          <span className="label">Zona</span>
          <input
            ref={zoneRef}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Ciudad, estado o país"
            maxLength={120}
            autoComplete="off"
            disabled={running}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={running}>
          {running ? 'Buscando…' : 'Buscar negocios'}
        </button>
      </form>

      {!run && (
        <div className="composer-foot">
          <span>Prueba:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.niche}
              type="button"
              className="example-chip"
              onClick={() => {
                setNiche(ex.niche)
                setZone(ex.zone)
              }}
            >
              {ex.niche} · {ex.zone.split(',')[0]}
            </button>
          ))}
        </div>
      )}
      {!run && (
        <p className="composer-foot">
          {maxLeads ? `Hasta ${maxLeads} negocios por búsqueda.` : null}{' '}
          <button type="button" className="text-link" onClick={onImport}>
            O importa un CSV
          </button>
        </p>
      )}

      {run && (
        <div className="run-card" role="status" aria-live="polite">
          <div className={`run-head ${run.state === 'done' ? 'is-done' : run.state === 'error' ? 'is-error' : ''}`}>
            <span className="label">{run.title}</span>
            <span className="label">
              {run.state === 'running' && <span className="live-dot" aria-hidden="true" />}
              {run.state === 'running' ? 'En curso' : run.state === 'done' ? 'Lista' : 'Con error'}
            </span>
          </div>
          <ol className="run-steps">
            {run.steps.map((step, i) => (
              <li key={i} className={`run-step is-${step.state}`}>
                {step.state === 'running' ? (
                  <span className="live-dot" aria-hidden="true" />
                ) : step.state === 'done' ? (
                  <Check aria-hidden="true" />
                ) : (
                  <CircleAlert aria-hidden="true" />
                )}
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
          {run.state !== 'running' && (
            <div className="run-actions">
              {run.jobId && run.state === 'done' && (
                <Link href={`/bases/${run.jobId}`} className="btn btn-primary btn-sm">
                  Abrir la base <ArrowRight aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRun(null)
                  if (run.state === 'done') {
                    setNiche('')
                    setZone('')
                  }
                  nicheRef.current?.focus()
                }}
              >
                {run.state === 'error' ? 'Corregir y reintentar' : 'Otra búsqueda'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default SearchComposer

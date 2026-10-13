'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import type { Lead } from './lead-types'
import { useNow } from './shell/useNow'

type JobStatus = 'queued' | 'running' | 'published' | 'skipped' | 'failed' | 'canceled'
type Step = 'audit' | 'research' | 'build' | 'publish'

interface DemoJob {
  id: number
  status: JobStatus
  step: Step | null
  log: { at: string; step: Step | null; text: string }[]
  demoUrl: string | null
  slug: string | null
  audit: { eligible?: boolean; score?: number; reasons?: string[]; hook?: string } | null
  error: string | null
  attempts: number
  notBefore: string | null
  createdAt: string
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'audit', label: 'Auditoría' },
  { key: 'research', label: 'Investigación' },
  { key: 'build', label: 'Construcción' },
  { key: 'publish', label: 'Publicación' },
]

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: 'En cola',
  running: 'En curso',
  published: 'Publicada',
  skipped: 'No hizo falta',
  failed: 'Falló',
  canceled: 'Cancelada',
}

function time(iso: string) {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface DemoPanelProps {
  lead: Lead
  /** Se llama cuando la cola cambia, para refrescar la lista y la barra. */
  onChanged: () => void
  toast: (title: string, desc?: string, type?: 'success' | 'error') => void
}

/** La demo de un negocio: en qué paso va, qué dijo cada paso y el enlace cuando se publica. */
export default function DemoPanel({ lead, onChanged, toast }: DemoPanelProps) {
  const [jobs, setJobs] = useState<DemoJob[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const now = useNow()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/demos?leadId=${lead.id}`)
      if (res.ok) setJobs((await res.json()).jobs)
    } catch {
      // El siguiente refresco lo intenta otra vez.
    }
  }, [lead.id])

  useEffect(() => {
    const first = setTimeout(load, 0)
    return () => clearTimeout(first)
  }, [load])

  const latest = jobs?.[0] ?? null
  const active = latest?.status === 'queued' || latest?.status === 'running'
  useEffect(() => {
    if (!active) return
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [active, load])

  const enqueue = async () => {
    setBusy(true)
    const res = await fetch('/api/demos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: [lead.id] }),
    }).catch(() => null)
    setBusy(false)
    const data = await res?.json().catch(() => ({}))
    if (res?.ok && data.queued > 0) {
      toast('Demo en cola', 'La Mac la toma en cuanto tenga un lugar libre.')
      load()
      onChanged()
    } else toast('No se pudo poner en cola', data?.error ?? 'Ya tiene una demo en curso o publicada.', 'error')
  }

  const cancel = async () => {
    if (!latest) return
    setBusy(true)
    const res = await fetch(`/api/demos?id=${latest.id}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      toast('Demo cancelada', lead.title)
      load()
      onChanged()
    } else toast('Ya no se puede cancelar', 'La Mac ya empezó a prepararla.', 'error')
  }

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const demoUrl = latest?.demoUrl ?? lead.demoUrl
  const currentIndex = latest?.step ? STEPS.findIndex((s) => s.key === latest.step) : -1
  const discarded = lead.stage === 'discarded'

  return (
    <section className="drawer-section">
      <h3>
        Demo {latest && <span className={`label demo-status is-${latest.status}`}>{STATUS_TEXT[latest.status]}</span>}
      </h3>

      {demoUrl && (
        <div className="demo-link">
          <a href={demoUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {demoUrl.replace(/^https?:\/\//, '')}
          </a>
          <button type="button" className="icon-btn" onClick={() => copy(demoUrl)} aria-label="Copiar el enlace de la demo">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button>
        </div>
      )}

      {jobs === null && <div className="skeleton" style={{ height: 40 }} aria-hidden="true" />}

      {jobs !== null && !latest && !demoUrl && (
        <p className="drawer-note" style={{ marginTop: 0 }}>
          Todavía no tiene demo. La Mac primero audita su sitio, luego investiga el negocio a fondo (Google, redes, directorios) y solo
          entonces construye y publica la propuesta.
        </p>
      )}

      {latest && (latest.status === 'queued' || latest.status === 'running') && (
        <ol className="demo-steps" aria-label="Pasos de la demo">
          {STEPS.map((s, i) => (
            <li key={s.key} className={i < currentIndex ? 'is-done' : i === currentIndex ? 'is-current' : ''}>
              <span className="demo-step-mark" aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ol>
      )}

      {latest?.status === 'queued' && latest.notBefore && new Date(latest.notBefore).getTime() > now && (
        <p className="drawer-note">Se reintenta después de las {time(latest.notBefore)}. {latest.error}</p>
      )}

      {latest?.status === 'skipped' && latest.audit?.reasons?.length ? (
        <div className="drawer-note">
          La auditoría visual concluyó que su sitio no necesita un rediseño:
          <ul className="demo-reasons">
            {latest.audit.reasons.slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {latest?.status === 'failed' && latest.error && <p className="drawer-note">Último error: {latest.error}</p>}

      {latest && latest.log.length > 0 && (
        <ul className="demo-log">
          {[...latest.log].reverse().slice(0, 6).map((entry, i) => (
            <li key={`${entry.at}-${i}`}>
              <span className="demo-log-time">{time(entry.at)}</span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="demo-actions">
        {!active && !discarded && latest?.status !== 'published' && (
          <button type="button" className="btn btn-light btn-sm" onClick={enqueue} disabled={busy}>
            {latest?.status === 'failed' ? 'Reintentar la demo' : latest?.status === 'skipped' ? 'Preparar de todos modos' : 'Preparar demo'}
          </button>
        )}
        {latest?.status === 'queued' && (
          <button type="button" className="btn btn-light btn-sm" onClick={cancel} disabled={busy}>
            Cancelar
          </button>
        )}
      </div>
    </section>
  )
}

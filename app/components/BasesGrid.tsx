'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface JobBase {
  id: number
  name?: string | null
  icon?: string | null
  color?: string | null
  niche: string
  zone: string
  status: string
  leadsFound: number
  createdAt: string
  _count?: { leads: number }
}

interface BasesGridProps {
  jobs: JobBase[]
  onDeleteJob: (jobId: number) => void
  onRenameJob: (jobId: number, newName: string) => void
  loading?: boolean
}

export default function BasesGrid({
  jobs,
  onDeleteJob,
  onRenameJob,
  loading = false,
}: BasesGridProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [filterText, setFilterText] = useState('')
  const [timeReference] = useState(() => Date.now())

  const handleStartRename = (job: JobBase, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(job.id)
    setEditName(job.name || `${job.niche} · ${job.zone}`)
  }

  const handleSaveRename = (jobId: number, e: React.FormEvent) => {
    e.preventDefault()
    if (editName.trim()) {
      onRenameJob(jobId, editName.trim())
    }
    setEditingId(null)
  }

  const getTimeAgo = (dateStr: string) => {
    const diffMs = timeReference - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'Recién creado'
    if (diffMins < 60) return `Hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Hace ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Ayer'
    return `Hace ${diffDays} días`
  }

  const filteredJobs = jobs.filter((job) => {
    const title = job.name || `${job.niche} ${job.zone}`
    const query = filterText.toLowerCase()
    return (
      title.toLowerCase().includes(query) ||
      job.niche.toLowerCase().includes(query) ||
      job.zone.toLowerCase().includes(query)
    )
  })

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

  const last7Days = filteredJobs.filter(
    (job) => timeReference - new Date(job.createdAt).getTime() <= SEVEN_DAYS
  )
  const last30Days = filteredJobs.filter((job) => {
    const age = timeReference - new Date(job.createdAt).getTime()
    return age > SEVEN_DAYS && age <= THIRTY_DAYS
  })
  const older = filteredJobs.filter(
    (job) => timeReference - new Date(job.createdAt).getTime() > THIRTY_DAYS
  )

  const renderStatus = (status: string) => {
    if (status === 'running') {
      return (
        <span className="base-status base-status-running">
          <span className="base-status-dot" />
          Extrayendo
        </span>
      )
    }

    if (status === 'error') {
      return (
        <span className="base-status base-status-error">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.75 14.25 13H1.75L8 1.75Z" />
            <path d="M8 5.8v3.4M8 11.6h.01" />
          </svg>
          Error
        </span>
      )
    }

    return (
      <span className="base-status base-status-done">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 8.4 2.45 2.45L12.2 5.1" />
        </svg>
        Lista
      </span>
    )
  }

  const renderJobCard = (job: JobBase) => {
    const leadCount = job._count?.leads ?? job.leadsFound ?? 0
    const initials =
      job.icon ||
      job.niche
        .split(' ')
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('') ||
      'NP'
    const bgAccent = job.color || '#ffffff'
    const title = job.name || `${job.niche} · ${job.zone}`

    return (
      <article
        key={job.id}
        className="base-card"
        onClick={() => router.push(`/bases/${job.id}`)}
        aria-label={`Abrir base ${title}`}
      >
        <span className="base-card-accent" style={{ backgroundColor: bgAccent }} aria-hidden="true" />

        <div className="base-card-main">
          <div className="base-card-topline">
            <div className="base-card-badge" style={{ color: bgAccent }}>
              {initials.slice(0, 2)}
            </div>

            <div className="base-card-heading">
              {editingId === job.id ? (
                <form
                  onSubmit={(e) => handleSaveRename(job.id, e)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    className="form-input base-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onBlur={(e) => handleSaveRename(job.id, e)}
                  />
                </form>
              ) : (
                <h3 className="base-card-title">{title}</h3>
              )}

              <div className="base-card-location">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 14s5-4.15 5-8a5 5 0 0 0-10 0c0 3.85 5 8 5 8Z" />
                  <circle cx="8" cy="6" r="1.7" />
                </svg>
                <span>{job.zone}</span>
              </div>
            </div>
          </div>

          <div className="base-card-footer">
            <div className="base-card-metric">
              <span className="base-card-metric-value">{leadCount}</span>
              <span className="base-card-metric-label">
                prospecto{leadCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="base-card-meta">
              {renderStatus(job.status)}
              <span className="base-card-time">{getTimeAgo(job.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="base-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="base-card-btn"
            title="Renombrar base"
            aria-label="Renombrar base"
            onClick={(e) => handleStartRename(job, e)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M9.8 3.15 12.85 6.2M2.75 13.25l3.3-.62 6.9-6.9a2.16 2.16 0 0 0-3.05-3.05L3 9.58l-.25 3.67Z" />
            </svg>
          </button>
          <button
            type="button"
            className="base-card-btn danger"
            title="Eliminar base"
            aria-label="Eliminar base"
            onClick={() => {
              if (confirm(`¿Eliminar la base "${title}" y todos sus leads?`)) {
                onDeleteJob(job.id)
              }
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.2 4.2h9.6M6.4 2.6h3.2M5.1 4.2l.45 8.25c.04.75.66 1.35 1.42 1.35h2.06c.76 0 1.38-.6 1.42-1.35l.45-8.25M6.8 6.7v4.4M9.2 6.7v4.4" />
            </svg>
          </button>
        </div>
      </article>
    )
  }

  return (
    <section className="bases-section">
      <div className="bases-header">
        <div>
          <h2 className="bases-title">Tus Bases de Leads</h2>
          <p className="bases-subtitle">
            Selecciona una base para explorar sus prospectos o usa el agente para crear una nueva
          </p>
        </div>

        {jobs.length > 0 && (
          <div className="search-wrapper bases-search">
            <svg className="search-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar base..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="bases-grid-skeleton">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="base-card-skeleton" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bases-empty">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h3.35l1.8 2H17.5A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-9Z" />
              <path d="M8 12h8M8 15h5" />
            </svg>
          </div>
          <div className="empty-title">
            {filterText ? 'No hay bases que coincidan con la búsqueda' : 'Aún no tienes bases de prospectos'}
          </div>
          <div className="empty-sub">
            {filterText
              ? 'Intenta con otro término de búsqueda'
              : 'Ingresa un nicho y zona en el Agente de Prospección para crear tu primera base.'}
          </div>
        </div>
      ) : (
        <div className="bases-groups">
          {last7Days.length > 0 && (
            <div className="bases-group">
              <h3 className="bases-group-label">Últimos 7 días</h3>
              <div className="bases-grid">
                {last7Days.map((job) => renderJobCard(job))}
              </div>
            </div>
          )}

          {last30Days.length > 0 && (
            <div className="bases-group">
              <h3 className="bases-group-label">Últimos 30 días</h3>
              <div className="bases-grid">
                {last30Days.map((job) => renderJobCard(job))}
              </div>
            </div>
          )}

          {older.length > 0 && (
            <div className="bases-group">
              <h3 className="bases-group-label">Anteriores</h3>
              <div className="bases-grid">
                {older.map((job) => renderJobCard(job))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .bases-section {
          margin-top: var(--space-8);
        }

        .bases-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
          flex-wrap: wrap;
        }

        .bases-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0;
        }

        .bases-subtitle {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: var(--space-1);
        }

        .bases-search {
          width: min(100%, 260px);
          flex: 0 0 auto;
        }

        .bases-groups {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .bases-group-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: var(--space-3);
        }

        .bases-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--space-4);
        }

        .base-card {
          min-height: 152px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          cursor: pointer;
          transition:
            background var(--transition-base),
            border-color var(--transition-base),
            box-shadow var(--transition-base),
            transform var(--transition-base);
          display: flex;
          gap: var(--space-3);
          position: relative;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .base-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent 45%);
          opacity: 0;
          transition: opacity var(--transition-base);
        }

        .base-card:hover {
          background: var(--bg-elevated);
          border-color: var(--border-default);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .base-card:hover::before {
          opacity: 1;
        }

        .base-card-accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          opacity: 0.95;
        }

        .base-card-main {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          justify-content: space-between;
          gap: var(--space-5);
        }

        .base-card-topline {
          display: flex;
          gap: var(--space-3);
          align-items: flex-start;
          min-width: 0;
        }

        .base-card-badge {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .base-card-heading {
          min-width: 0;
          flex: 1;
        }

        .base-card-title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
          color: var(--text-primary);
          letter-spacing: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .base-card-location {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: var(--space-1);
          color: var(--text-tertiary);
          font-size: 12px;
          min-width: 0;
        }

        .base-card-location svg {
          width: 13px;
          height: 13px;
          flex: 0 0 13px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .base-card-location span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .base-rename-input {
          height: 32px;
          padding: 6px 10px;
          font-size: 13px;
        }

        .base-card-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: var(--space-3);
        }

        .base-card-metric {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .base-card-metric-value {
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: 0;
        }

        .base-card-metric-label {
          font-size: 11px;
          color: var(--text-tertiary);
          font-weight: 500;
        }

        .base-card-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--space-2);
          min-width: max-content;
        }

        .base-card-time {
          font-size: 11px;
          color: var(--text-tertiary);
          white-space: nowrap;
        }

        .base-status {
          min-height: 24px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-subtle);
          background: var(--bg-base);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .base-status svg {
          width: 12px;
          height: 12px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .base-status-done {
          color: var(--text-secondary);
        }

        .base-status-running {
          color: #ffffff;
          border-color: var(--border-default);
        }

        .base-status-error {
          color: #ff4444;
          border-color: rgba(255, 68, 68, 0.32);
          background: rgba(255, 68, 68, 0.08);
        }

        .base-status-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 6px;
          border-radius: 50%;
          background: currentColor;
          animation: basePulse 1.2s ease-in-out infinite;
        }

        @keyframes basePulse {
          0%, 100% { opacity: 0.35; transform: scale(0.82); }
          50% { opacity: 1; transform: scale(1.12); }
        }

        .base-card-actions {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          opacity: 0;
          transform: translateX(4px);
          transition:
            opacity var(--transition-fast),
            transform var(--transition-fast);
        }

        .base-card:hover .base-card-actions,
        .base-card:focus-within .base-card-actions {
          opacity: 1;
          transform: translateX(0);
        }

        .base-card-btn {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition:
            background var(--transition-fast),
            border-color var(--transition-fast),
            color var(--transition-fast);
        }

        .base-card-btn svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .base-card-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-default);
          color: var(--text-primary);
        }

        .base-card-btn.danger:hover {
          color: #ff4444;
          border-color: rgba(255, 68, 68, 0.35);
          background: rgba(255, 68, 68, 0.08);
        }

        .bases-empty {
          padding: var(--space-12) var(--space-6);
          text-align: center;
          background: var(--bg-surface);
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-lg);
        }

        .bases-empty .empty-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto var(--space-3);
        }

        .bases-empty .empty-icon svg {
          width: 24px;
          height: 24px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .bases-empty .empty-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .bases-empty .empty-sub {
          font-size: 13px;
          color: var(--text-tertiary);
          margin-top: var(--space-1);
          max-width: 420px;
          margin-left: auto;
          margin-right: auto;
        }

        .bases-grid-skeleton {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--space-4);
        }

        .base-card-skeleton {
          height: 152px;
          background: linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%);
          background-size: 200% 100%;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          animation: shimmer 1.5s infinite;
        }

        @media (max-width: 768px) {
          .bases-header {
            align-items: stretch;
          }

          .bases-search {
            width: 100%;
          }

          .bases-grid,
          .bases-grid-skeleton {
            grid-template-columns: 1fr;
          }

          .base-card {
            min-height: 146px;
          }

          .base-card-actions {
            opacity: 1;
            transform: none;
          }
        }

        @media (max-width: 480px) {
          .base-card-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .base-card-meta {
            align-items: flex-start;
            flex-direction: row;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </section>
  )
}

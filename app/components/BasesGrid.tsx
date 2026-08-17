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
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'Recién creado'
    if (diffMins < 60) return `Creado hace ${diffMins} min`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Creado hace ${diffHours} h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Creado ayer'
    return `Se creó hace ${diffDays} días`
  }

  // Filter jobs by search
  const filteredJobs = jobs.filter((j) => {
    const title = j.name || `${j.niche} ${j.zone}`
    return (
      title.toLowerCase().includes(filterText.toLowerCase()) ||
      j.niche.toLowerCase().includes(filterText.toLowerCase()) ||
      j.zone.toLowerCase().includes(filterText.toLowerCase())
    )
  })

  // Categorize jobs by time
  const now = Date.now()
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

  const last7Days = filteredJobs.filter(
    (j) => now - new Date(j.createdAt).getTime() <= SEVEN_DAYS
  )
  const last30Days = filteredJobs.filter((j) => {
    const age = now - new Date(j.createdAt).getTime()
    return age > SEVEN_DAYS && age <= THIRTY_DAYS
  })
  const older = filteredJobs.filter(
    (j) => now - new Date(j.createdAt).getTime() > THIRTY_DAYS
  )

  const renderJobCard = (job: JobBase) => {
    const leadCount = job._count?.leads ?? job.leadsFound ?? 0
    const initials =
      job.icon ||
      job.niche
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') ||
      'Le'
    const bgAccent = job.color || '#7c3aed'

    return (
      <div
        key={job.id}
        className="base-card"
        onClick={() => router.push(`/bases/${job.id}`)}
      >
        <div className="base-card-content">
          <div
            className="base-card-badge"
            style={{ backgroundColor: bgAccent }}
          >
            {initials}
          </div>

          <div className="base-card-details">
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
              <h3 className="base-card-title">
                {job.name || `${job.niche} · ${job.zone}`}
              </h3>
            )}

            <div className="base-card-sub">
              <span>{leadCount} prospecto{leadCount !== 1 ? 's' : ''}</span>
              <span className="dot-sep">•</span>
              <span>{getTimeAgo(job.createdAt)}</span>
            </div>

            {job.status === 'running' && (
              <div className="base-card-status running">
                <span className="pulse-dot" /> Extrayendo...
              </div>
            )}
            {job.status === 'error' && (
              <div className="base-card-status error">⚠️ Error en extracción</div>
            )}
          </div>
        </div>

        {/* Card actions */}
        <div className="base-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="base-card-btn"
            title="Renombrar base"
            onClick={(e) => handleStartRename(job, e)}
          >
            ✏️
          </button>
          <button
            type="button"
            className="base-card-btn danger"
            title="Eliminar base"
            onClick={() => {
              if (
                confirm(
                  `¿Eliminar la base "${job.name || `${job.niche} en ${job.zone}`}" y todos sus leads?`
                )
              ) {
                onDeleteJob(job.id)
              }
            }}
          >
            🗑️
          </button>
        </div>
      </div>
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
          <div className="search-wrap" style={{ maxWidth: 240 }}>
            <span className="search-icon">⌕</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar base..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ width: '100%' }}
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
          <div className="empty-icon">🗂️</div>
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

      <style jsx>{`
        .bases-section {
          margin-top: 32px;
        }

        .bases-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .bases-title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.3px;
        }

        .bases-subtitle {
          font-size: 13px;
          color: var(--text-tertiary, #888888);
          margin-top: 4px;
        }

        .bases-groups {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .bases-group-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-tertiary, #888888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .bases-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .base-card {
          background: var(--bg-surface, #141414);
          border: 1px solid var(--border-default, #222222);
          border-radius: var(--radius-lg, 12px);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
        }

        .base-card:hover {
          border-color: var(--border-subtle, #444444);
          transform: translateY(-2px);
          background: var(--bg-elevated, #1a1a1a);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .base-card-content {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }

        .base-card-badge {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          flex-shrink: 0;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .base-card-details {
          flex: 1;
          min-width: 0;
        }

        .base-card-title {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .base-rename-input {
          padding: 3px 8px;
          font-size: 13px;
          height: 28px;
          width: 100%;
        }

        .base-card-sub {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-tertiary, #888888);
          margin-top: 4px;
        }

        .dot-sep {
          opacity: 0.4;
        }

        .base-card-status {
          font-size: 11px;
          font-weight: 600;
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .base-card-status.running {
          color: #38bdf8;
        }

        .base-card-status.error {
          color: #f87171;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #38bdf8;
          display: inline-block;
          animation: pulse 1.2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
          100% { opacity: 0.3; transform: scale(0.8); }
        }

        .base-card-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.15s ease;
          margin-left: 8px;
        }

        .base-card:hover .base-card-actions {
          opacity: 1;
        }

        .base-card-btn {
          background: transparent;
          border: none;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.15s;
        }

        .base-card-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .base-card-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .bases-empty {
          padding: 48px 24px;
          text-align: center;
          background: var(--bg-surface, #141414);
          border: 1px dashed var(--border-default, #222222);
          border-radius: var(--radius-lg, 12px);
        }

        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
          opacity: 0.6;
        }

        .empty-title {
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
        }

        .empty-sub {
          font-size: 13px;
          color: var(--text-tertiary, #888888);
          margin-top: 4px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .bases-grid-skeleton {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .base-card-skeleton {
          height: 80px;
          background: var(--bg-surface, #141414);
          border-radius: var(--radius-lg, 12px);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </section>
  )
}

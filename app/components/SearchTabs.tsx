'use client'

export interface JobTab {
  id: number
  niche: string
  zone: string
  status: string
  leadsFound: number
  createdAt: string
  _count?: { leads: number }
}

interface SearchTabsProps {
  jobs: JobTab[]
  activeJobId: number | 'all'
  onSelectTab: (jobId: number | 'all') => void
  onDeleteJob: (jobId: number) => void
  totalLeadsCount: number
}

export default function SearchTabs({
  jobs,
  activeJobId,
  onSelectTab,
  onDeleteJob,
  totalLeadsCount,
}: SearchTabsProps) {
  return (
    <div className="search-tabs-container">
      <div className="search-tabs-scroll">
        {/* Tab: All Leads */}
        <button
          type="button"
          className={`search-tab-item ${activeJobId === 'all' ? 'active' : ''}`}
          onClick={() => onSelectTab('all')}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-title">Todas las Búsquedas</span>
          <span className="tab-count">{totalLeadsCount}</span>
        </button>

        {/* Individual Search Run Tabs */}
        {jobs.map((job) => {
          const count = job._count?.leads ?? job.leadsFound ?? 0
          const isSelected = activeJobId === job.id

          return (
            <div
              key={job.id}
              className={`search-tab-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectTab(job.id)}
            >
              <span className="tab-icon">🔍</span>
              <span className="tab-title">
                {job.niche} · <span className="tab-sub">{job.zone}</span>
              </span>
              <span className="tab-count">{count}</span>

              {/* Delete Job Button */}
              <button
                type="button"
                className="tab-delete-btn"
                title="Eliminar esta búsqueda"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`¿Eliminar la búsqueda de "${job.niche} en ${job.zone}" y sus prospectos?`)) {
                    onDeleteJob(job.id)
                  }
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .search-tabs-container {
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border-default);
          padding-bottom: 8px;
        }

        .search-tabs-scroll {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: thin;
        }

        .search-tab-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .search-tab-item:hover {
          background: var(--bg-elevated);
          color: #fff;
          border-color: var(--border-default);
        }

        .search-tab-item.active {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
          font-weight: 700;
        }

        .tab-icon {
          font-size: 13px;
        }

        .tab-title {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .tab-sub {
          opacity: 0.75;
          font-size: 12px;
        }

        .tab-count {
          font-size: 11px;
          padding: 2px 7px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.15);
          color: inherit;
        }

        .search-tab-item.active .tab-count {
          background: rgba(0, 0, 0, 0.12);
        }

        .tab-delete-btn {
          background: transparent;
          border: none;
          color: inherit;
          opacity: 0.4;
          font-size: 12px;
          margin-left: 4px;
          padding: 2px 4px;
          border-radius: 4px;
          cursor: pointer;
        }

        .tab-delete-btn:hover {
          opacity: 1;
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
      `}</style>
    </div>
  )
}

'use client'

interface Stats {
  total: number
  withPhone: number
  avgRating: number | null
  totalReviews: number | null
}

interface StatsPanelProps {
  stats: Stats
  loading?: boolean
}

export default function StatsPanel({ stats, loading }: StatsPanelProps) {
  if (loading) {
    return (
      <div className="stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <div className="skeleton" style={{ width: 80, height: 10 }} />
              <div className="skeleton" style={{ width: 60, height: 22 }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const items = [
    {
      label: 'Total Leads',
      value: stats.total.toLocaleString('es'),
      sub: 'en base de datos',
      icon: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="6" r="3.5" />
          <path d="M2.5 16c0-3.866 2.91-6 6.5-6s6.5 2.134 6.5 6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: 'Con Teléfono',
      value: stats.withPhone.toLocaleString('es'),
      sub: `${stats.total > 0 ? Math.round((stats.withPhone / stats.total) * 100) : 0}% contactables`,
      icon: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 3.5h2.5l1 3-1.5 1c.9 1.8 2.5 3.4 4.3 4.3l1-1.5 3 1V14c0 .8-.7 1.5-1.5 1.5C6.5 15.5 2.5 11.5 2 5c0-.8.7-1.5 1.5-1.5z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: 'Rating Promedio',
      value: stats.avgRating ? `★ ${stats.avgRating.toFixed(1)}` : '—',
      sub: 'de 5.0 estrella',
      icon: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 2l2.09 4.26L16 7.27l-3.5 3.41.83 4.82L9 13.27l-4.33 2.23.83-4.82L2 7.27l4.91-.71L9 2z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: 'Total Reseñas',
      value: stats.totalReviews ? stats.totalReviews.toLocaleString('es') : '0',
      sub: 'reseñas acumuladas',
      icon: (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2h14v10H9l-4 4v-4H2V2z" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  return (
    <div className="stats-grid">
      {items.map((item) => (
        <div key={item.label} className="stat-card">
          <div className="stat-icon">{item.icon}</div>
          <div className="stat-info">
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">{item.value}</div>
            <div className="stat-sub">{item.sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

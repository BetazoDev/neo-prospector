'use client'

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  sort: string
  onSortChange: (v: string) => void
  withPhone: boolean
  onWithPhoneChange: (v: boolean) => void
  view: 'table' | 'grid'
  onViewChange: (v: 'table' | 'grid') => void
  total: number
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Más Recientes' },
  { value: 'rating', label: 'Mayor Rating' },
  { value: 'reviews', label: 'Más Reseñas' },
  { value: 'phone', label: 'Con Teléfono' },
]

export default function FilterBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  withPhone,
  onWithPhoneChange,
  view,
  onViewChange,
  total,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      {/* Search */}
      <div className="search-wrapper">
        <svg className="search-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="6" cy="6" r="4" />
          <path d="M10 10l3 3" strokeLinecap="round" />
        </svg>
        <input
          id="leads-search"
          type="text"
          className="search-input"
          placeholder="Buscar empresa, ciudad..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="filter-divider" />

      {/* Sort buttons */}
      <div className="sort-group">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            id={`sort-${opt.value}`}
            className={`btn btn-ghost btn-sm ${sort === opt.value ? 'active' : ''}`}
            onClick={() => onSortChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="filter-divider" />

      {/* With phone toggle */}
      <button
        id="filter-with-phone"
        className={`btn btn-ghost btn-sm ${withPhone ? 'active' : ''}`}
        onClick={() => onWithPhoneChange(!withPhone)}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}>
          <path d="M2.5 2.5h2l.75 2.25-1.25.75c.7 1.4 1.8 2.55 3.25 3.25l.75-1.25 2.25.75V11c0 .65-.6 1.2-1.25 1.2C5.25 12.2 1.8 8.75 1.3 4.75c0-.55.55-1.1 1.2-1.25z" strokeLinejoin="round" />
        </svg>
        Solo con Tel.
      </button>

      {/* Results count */}
      <span className="results-count">{total.toLocaleString('es')} resultados</span>

      {/* View toggle */}
      <div className="view-toggle">
        <button
          id="view-table"
          className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
          onClick={() => onViewChange('table')}
          title="Vista tabla"
        >
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4h13M1 8h13M1 12h13M5 2v11M10 2v11" strokeLinecap="round" />
          </svg>
        </button>
        <button
          id="view-grid"
          className={`view-toggle-btn ${view === 'grid' ? 'active' : ''}`}
          onClick={() => onViewChange('grid')}
          title="Vista tarjetas"
        >
          <svg viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" />
            <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" />
            <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" />
            <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

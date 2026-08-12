'use client'

import { getWaUrl } from '@/lib/whatsapp'

interface Lead {
  id: number
  title: string
  phone: string | null
  rating: number | null
  reviewsCount: number | null
  category: string | null
  address: string | null
  city: string | null
  website: string | null
  mapsUrl: string | null
  searchNiche: string | null
  searchZone: string | null
  createdAt: string
}

interface LeadsTableProps {
  leads: Lead[]
  view: 'table' | 'grid'
  total: number
  page: number
  pages: number
  onPageChange: (p: number) => void
  onDelete: (id: number) => void
  loading: boolean
}

function WhatsAppButton({ phone, title }: { phone: string | null; title: string }) {
  const url = getWaUrl(phone, title)
  if (!url || url === '#') return <span className="no-phone">Sin teléfono</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="wa-btn" id={`wa-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <svg viewBox="0 0 14 14" fill="currentColor">
        <path d="M7 0C3.134 0 0 3.134 0 7c0 1.232.32 2.387.877 3.387L0 14l3.7-.858A6.962 6.962 0 0 0 7 14c3.866 0 7-3.134 7-7S10.866 0 7 0zm3.55 9.95c-.15.42-.87.81-1.2.86-.31.05-.7.07-1.13-.07-.26-.09-.59-.2-.99-.39-1.74-.76-2.88-2.53-2.97-2.65-.09-.12-.72-.97-.72-1.85s.46-1.31.62-1.49c.16-.18.35-.22.47-.22l.34.01c.11 0 .26-.04.4.31.15.37.51 1.26.56 1.35.05.09.08.2.02.32-.06.12-.09.19-.18.3-.09.11-.19.24-.27.32-.09.09-.18.19-.08.38.1.19.45.75.97 1.21.67.6 1.23.79 1.41.88.18.09.28.08.38-.05.1-.13.44-.51.56-.69.12-.18.24-.15.4-.09.16.06 1.02.48 1.2.57.18.09.3.13.34.21.04.08.04.47-.11.89z" />
      </svg>
      WhatsApp
    </a>
  )
}

function TableView({ leads, onDelete }: { leads: Lead[]; onDelete: (id: number) => void }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Categoría</th>
            <th>Teléfono</th>
            <th>Rating</th>
            <th>Reseñas</th>
            <th>Ciudad</th>
            <th>Web</th>
            <th>Acción</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <div className="company-name">{lead.title}</div>
                {lead.searchZone && (
                  <div className="company-category">{lead.searchZone}</div>
                )}
              </td>
              <td className="td-secondary">{lead.category ?? '—'}</td>
              <td className="td-secondary">{lead.phone ?? '—'}</td>
              <td>
                {lead.rating ? (
                  <span className="rating-badge">
                    <span className="rating-star">★</span>
                    {lead.rating.toFixed(1)}
                  </span>
                ) : (
                  <span className="td-secondary">—</span>
                )}
              </td>
              <td className="td-secondary">
                {lead.reviewsCount ? lead.reviewsCount.toLocaleString('es') : '—'}
              </td>
              <td className="td-secondary">{lead.city ?? '—'}</td>
              <td>
                {lead.website ? (
                  <a
                    href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="website-link"
                  >
                    {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                ) : (
                  <span className="td-secondary">—</span>
                )}
              </td>
              <td>
                <WhatsAppButton phone={lead.phone} title={lead.title} />
              </td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDelete(lead.id)}
                  title="Eliminar lead"
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}>
                    <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GridView({ leads, onDelete }: { leads: Lead[]; onDelete: (id: number) => void }) {
  return (
    <div className="leads-grid">
      {leads.map((lead) => {
        const waUrl = getWaUrl(lead.phone, lead.title)
        return (
          <div key={lead.id} className="lead-card">
            <div className="card-header">
              <div>
                <div className="card-company">{lead.title}</div>
                <div className="card-category">{lead.category ?? 'Sin categoría'}</div>
              </div>
              {lead.rating && (
                <div className="card-rating">
                  <span style={{ color: 'var(--text-primary)' }}>★</span>
                  {lead.rating.toFixed(1)}
                </div>
              )}
            </div>

            <div className="card-details">
              {lead.phone && (
                <div className="card-detail-row">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2.5 2.5h2l.75 2.25-1.25.75c.7 1.4 1.8 2.55 3.25 3.25l.75-1.25 2.25.75V11c0 .65-.6 1.2-1.25 1.2C5.25 12.2 1.8 8.75 1.3 4.75c0-.55.55-1.1 1.2-1.25z" />
                  </svg>
                  {lead.phone}
                </div>
              )}
              {(lead.address || lead.city) && (
                <div className="card-detail-row">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" />
                    <circle cx="7" cy="5" r="1.5" />
                  </svg>
                  {[lead.address, lead.city].filter(Boolean).join(', ')}
                </div>
              )}
              {lead.reviewsCount && (
                <div className="card-detail-row">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 2h10v8H7L4 12V10H2V2z" />
                  </svg>
                  {lead.reviewsCount.toLocaleString('es')} reseñas
                </div>
              )}
              {lead.website && (
                <div className="card-detail-row">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="6" />
                    <path d="M7 1C5.5 3.5 5.5 10.5 7 13M7 1c1.5 2.5 1.5 9.5 0 12M1 7h12" />
                  </svg>
                  <a
                    href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
            </div>

            <div className="card-actions">
              {waUrl && waUrl !== '#' ? (
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="card-wa-btn">
                  <svg viewBox="0 0 14 14" fill="currentColor">
                    <path d="M7 0C3.134 0 0 3.134 0 7c0 1.232.32 2.387.877 3.387L0 14l3.7-.858A6.962 6.962 0 0 0 7 14c3.866 0 7-3.134 7-7S10.866 0 7 0zm3.55 9.95c-.15.42-.87.81-1.2.86-.31.05-.7.07-1.13-.07-.26-.09-.59-.2-.99-.39-1.74-.76-2.88-2.53-2.97-2.65-.09-.12-.72-.97-.72-1.85s.46-1.31.62-1.49c.16-.18.35-.22.47-.22l.34.01c.11 0 .26-.04.4.31.15.37.51 1.26.56 1.35.05.09.08.2.02.32-.06.12-.09.19-.18.3-.09.11-.19.24-.27.32-.09.09-.18.19-.08.38.1.19.45.75.97 1.21.67.6 1.23.79 1.41.88.18.09.28.08.38-.05.1-.13.44-.51.56-.69.12-.18.24-.15.4-.09.16.06 1.02.48 1.2.57.18.09.3.13.34.21.04.08.04.47-.11.89z" />
                  </svg>
                  CONTACTAR POR WHATSAPP
                </a>
              ) : (
                <span className="no-phone" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                  Sin teléfono disponible
                </span>
              )}
              {lead.mapsUrl && (
                <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="card-maps-btn" title="Ver en Google Maps">
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 8 4 8s4-4.75 4-8c0-2.21-1.79-4-4-4z" />
                    <circle cx="7" cy="5" r="1.5" />
                  </svg>
                </a>
              )}
              <button className="card-maps-btn" onClick={() => onDelete(lead.id)} title="Eliminar" style={{ border: '1px solid #330000', color: '#ff4444' }}>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LeadsTable({
  leads,
  view,
  total,
  page,
  pages,
  onPageChange,
  onDelete,
  loading,
}: LeadsTableProps) {
  if (loading) {
    return (
      <div className="leads-container">
        <div style={{ padding: 32 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 200, height: 16 }} />
              <div className="skeleton" style={{ width: 100, height: 16 }} />
              <div className="skeleton" style={{ width: 120, height: 16 }} />
              <div className="skeleton" style={{ width: 60, height: 16 }} />
              <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="leads-container">
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" strokeLinecap="round" />
            </svg>
          </div>
          <div className="empty-title">No hay leads aún</div>
          <div className="empty-desc">
            Usa el Agente IA de arriba para lanzar tu primera búsqueda en Google Maps.
            Ingresa un nicho y una zona para comenzar.
          </div>
        </div>
      </div>
    )
  }

  const pageNumbers = Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1)

  return (
    <div className="leads-container">
      {view === 'table' ? (
        <TableView leads={leads} onDelete={onDelete} />
      ) : (
        <GridView leads={leads} onDelete={onDelete} />
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ‹
          </button>

          {pageNumbers.map((p) => (
            <button
              key={p}
              className={`page-btn ${p === page ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          {pages > 10 && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>...</span>}

          <button
            className="page-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}

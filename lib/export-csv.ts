import { STAGES, type Stage } from './pipeline/stages'
import { SITE_KIND, SITE_STATUS } from './pipeline/labels'

interface ExportableLead {
  id: number
  title: string
  category: string | null
  phone: string | null
  rating: number | null
  reviewsCount: number | null
  city: string | null
  address: string | null
  website: string | null
  mapsUrl: string | null
  searchNiche?: string | null
  searchZone?: string | null
  stage?: string
  siteKind?: string | null
  siteStatus?: string | null
  siteScore?: number | null
  siteIssues?: { label: string }[] | null
  siteWhatsapp?: string[]
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  return `"${value.replace(/"/g, '""')}"`
}

/**
 * CSV de una base. Las diez primeras columnas conservan los nombres de siempre porque los
 * scripts del flujo de demos (build_list.py y compañía) las leen por nombre.
 */
export function buildLeadsCsv(leads: ExportableLead[], { withSearch = false } = {}): string {
  const headers = ['ID', 'Empresa', 'Categoría', 'Teléfono', 'Rating', 'Reseñas', 'Ciudad', 'Dirección', 'Sitio Web', 'Google Maps']
  if (withSearch) headers.push('Nicho', 'Zona')
  headers.push('Etapa', 'Estado del sitio', 'Oportunidad', 'Problemas', 'WhatsApp del sitio')

  const rows = leads.map((l) => {
    const status = l.siteKind && l.siteKind !== 'web' ? SITE_KIND[l.siteKind] : l.siteStatus ? SITE_STATUS[l.siteStatus]?.label : null
    const row = [
      cell(l.id),
      cell(l.title),
      cell(l.category),
      cell(l.phone),
      cell(l.rating),
      cell(l.reviewsCount),
      cell(l.city),
      cell(l.address),
      cell(l.website),
      cell(l.mapsUrl),
    ]
    if (withSearch) row.push(cell(l.searchNiche), cell(l.searchZone))
    row.push(
      cell(l.stage ? (STAGES[l.stage as Stage]?.label ?? l.stage) : null),
      cell(status ?? null),
      cell(l.siteScore ?? null),
      cell((l.siteIssues ?? []).filter((i) => i.label).map((i) => i.label).join('; ') || null),
      cell((l.siteWhatsapp ?? []).join(' ') || null)
    )
    return row.join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

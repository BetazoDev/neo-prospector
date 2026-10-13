export interface SiteIssue {
  code: string
  label: string
  weight: number
}

export interface Lead {
  id: number
  jobId: number
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
  domain: string | null
  siteKind: string | null
  phoneDigits: string | null
  stage: string
  stageChangedAt: string | null
  checkState: string | null
  checkedAt: string | null
  checkError: string | null
  siteStatus: string | null
  httpStatus: number | null
  finalUrl: string | null
  siteTitle: string | null
  siteCms: string | null
  siteIssues: SiteIssue[] | null
  siteScore: number | null
  siteWhatsapp: string[]
  demoUrl: string | null
  demoSlug: string | null
  job?: { id: number; name: string | null; niche: string; zone: string }
}

export interface LeadStats {
  total: number
  withPhone: number
  avgRating: number | null
  totalReviews: number | null
  withWebsite: number
  candidates: number
  withWhatsapp: number
}

export const EMPTY_STATS: LeadStats = {
  total: 0,
  withPhone: 0,
  avgRating: null,
  totalReviews: null,
  withWebsite: 0,
  candidates: 0,
  withWhatsapp: 0,
}

export type LeadAction = 'discard' | 'restore' | 'recheck' | 'promote'

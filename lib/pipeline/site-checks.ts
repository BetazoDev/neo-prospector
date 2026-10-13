import { after } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { analyzeSite, stageForAnalysis, type SiteAnalysis } from './analyze-site'
import { fetchSite, FetchFailure } from './fetch-site'
import { AUTO_STAGES, type Stage } from './stages'
import { normalizeWebsite, triageLead } from './triage'

/**
 * Cola de revisión de sitios, guardada en la propia tabla de leads.
 *
 * Igual que la importación de Apify, es idempotente y segura en paralelo: cada lead se
 * toma con un cambio de estado atómico, así que la revisión de fondo y la que dispara la
 * pantalla nunca revisan el mismo sitio dos veces. Un lead tomado por un proceso que murió
 * se libera solo pasado un rato.
 */

const CLAIM_STALE_MS = 3 * 60 * 1000
/** Si otra base ya revisó el mismo dominio hace poco, se reutiliza esa revisión. */
const REUSE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 6
const CONCURRENCY = 3
const DRAIN_CONCURRENCY = 4
const RETRY_DELAY_MS = 3000
/** Una pasada en segundo plano no debería ocupar el servidor más de esto. */
const DRAIN_BUDGET_MS = 6 * 60 * 1000

export interface CheckScope {
  userId: string
  jobId?: number
}

export interface CheckProgress {
  total: number
  pending: number
  running: number
  done: number
  failed: number
  stages: Partial<Record<Stage, number>>
}

function scopeWhere(scope: CheckScope): Prisma.LeadWhereInput {
  return scope.jobId ? { userId: scope.userId, jobId: scope.jobId } : { userId: scope.userId }
}

/**
 * Clasifica los leads que entraron antes de que existiera el embudo (o por una vía que no
 * los clasificó). Es barato: no toca la red.
 */
export async function triageUnclassified(scope: CheckScope): Promise<number> {
  const rows = await prisma.lead.findMany({
    where: { ...scopeWhere(scope), stage: 'new' },
    select: { id: true, website: true, phone: true, mapsUrl: true, countryCode: true, placeId: true },
    take: 2000,
  })

  for (let i = 0; i < rows.length; i += 200) {
    await prisma.$transaction(
      rows.slice(i, i + 200).map((row) =>
        prisma.lead.update({
          where: { id: row.id },
          data: { ...triageLead(row), stageChangedAt: new Date() },
        })
      )
    )
  }
  return rows.length
}

function claimableWhere(scope: CheckScope): Prisma.LeadWhereInput {
  return {
    ...scopeWhere(scope),
    OR: [
      { checkState: 'pending' },
      { checkState: 'running', checkClaimedAt: { lt: new Date(Date.now() - CLAIM_STALE_MS) } },
    ],
  }
}

async function claimBatch(scope: CheckScope, limit: number) {
  const candidates = await prisma.lead.findMany({
    where: claimableWhere(scope),
    select: { id: true, userId: true, title: true, website: true, domain: true, stage: true },
    orderBy: { id: 'asc' },
    // Holgura para los carriles que compiten por las mismas filas: si otro gana una, hay más.
    take: limit + 10,
  })

  const claimed: typeof candidates = []
  for (const lead of candidates) {
    if (claimed.length >= limit) break
    const result = await prisma.lead.updateMany({
      where: { id: lead.id, ...claimableWhere(scope) },
      data: { checkState: 'running', checkClaimedAt: new Date() },
    })
    if (result.count === 1) claimed.push(lead)
  }
  return claimed
}

type ClaimedLead = Awaited<ReturnType<typeof claimBatch>>[number]

function resultData(analysis: SiteAnalysis) {
  return {
    siteStatus: analysis.status,
    httpStatus: analysis.httpStatus,
    finalUrl: analysis.finalUrl,
    siteTitle: analysis.title,
    siteCms: analysis.cms,
    siteIssues: analysis.issues as unknown as Prisma.InputJsonValue,
    siteScore: analysis.score,
  }
}

async function reusableCheck(lead: ClaimedLead) {
  if (!lead.domain) return null
  return prisma.lead.findFirst({
    where: {
      userId: lead.userId,
      domain: lead.domain,
      id: { not: lead.id },
      checkState: 'done',
      checkedAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) },
    },
    orderBy: { checkedAt: 'desc' },
    select: {
      siteStatus: true,
      httpStatus: true,
      finalUrl: true,
      siteTitle: true,
      siteCms: true,
      siteIssues: true,
      siteScore: true,
      siteWhatsapp: true,
      checkedAt: true,
    },
  })
}

async function checkOne(lead: ClaimedLead): Promise<void> {
  try {
    const previous = await reusableCheck(lead)
    let data: Prisma.LeadUpdateInput
    let nextStage: Stage

    if (previous) {
      const { siteIssues, checkedAt, ...rest } = previous
      data = { ...rest, siteIssues: siteIssues ?? Prisma.JsonNull, checkedAt }
      nextStage = stageForAnalysis({
        status: (previous.siteStatus ?? 'ok') as SiteAnalysis['status'],
        score: previous.siteScore ?? 0,
      })
    } else {
      const site = normalizeWebsite(lead.website)
      const attempt = () =>
        fetchSite(site!.url).catch((error: unknown) => {
          if (error instanceof FetchFailure) return error
          throw error
        })
      let result = site ? await attempt() : new FetchFailure('blocked', 'URL inválida')
      // Un servidor lento o un tropiezo de red no basta para declarar caído un sitio.
      if (site && result instanceof FetchFailure && (result.kind === 'timeout' || result.kind === 'refused')) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        result = await attempt()
      }
      const analysis = analyzeSite(result, { businessName: lead.title })
      data = { ...resultData(analysis), siteWhatsapp: analysis.whatsapp, checkedAt: new Date() }
      nextStage = stageForAnalysis(analysis)
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { ...data, checkState: 'done', checkError: null, checkClaimedAt: null },
    })
    // La etapa solo se mueve si nadie la cambió a mano mientras se revisaba.
    await prisma.lead.updateMany({
      where: { id: lead.id, stage: { in: [...AUTO_STAGES] } },
      data: { stage: nextStage, stageChangedAt: new Date() },
    })
  } catch (error) {
    console.error(`[site-check] lead ${lead.id}:`, error)
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        checkState: 'error',
        checkClaimedAt: null,
        checkError: (error instanceof Error ? error.message : String(error)).slice(0, 300),
      },
    })
  }
}

export async function getCheckProgress(scope: CheckScope): Promise<CheckProgress> {
  const [byState, byStage] = await Promise.all([
    prisma.lead.groupBy({ by: ['checkState'], where: scopeWhere(scope), _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['stage'], where: scopeWhere(scope), _count: { _all: true } }),
  ])

  const count = (state: string) => byState.find((row) => row.checkState === state)?._count._all ?? 0
  return {
    total: byStage.reduce((sum, row) => sum + row._count._all, 0),
    pending: count('pending'),
    running: count('running'),
    done: count('done'),
    failed: count('error'),
    stages: Object.fromEntries(byStage.map((row) => [row.stage, row._count._all])),
  }
}

interface ProcessOptions {
  /** Cuántos sitios revisar como mucho en esta llamada. */
  maxLeads?: number
  /** Sitios en paralelo. Cada carril toma el siguiente en cuanto termina, sin esperar a los demás. */
  concurrency?: number
  /** Hora límite para tomar sitios nuevos; los que ya empezaron terminan. */
  until?: number
}

/** Revisa un lote y devuelve el avance. Lo llama la pantalla mientras queden pendientes. */
export async function processSiteChecks(
  scope: CheckScope,
  { maxLeads = BATCH_SIZE, concurrency = CONCURRENCY, until = Infinity }: ProcessOptions = {}
): Promise<CheckProgress> {
  await triageUnclassified(scope)
  let taken = 0
  const lane = async () => {
    while (taken < maxLeads && Date.now() < until) {
      taken++
      const [lead] = await claimBatch(scope, 1)
      if (!lead) return
      await checkOne(lead)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane))
  return getCheckProgress(scope)
}

/** Devuelve a la cola los sitios cuya revisión falló, para intentarlo otra vez. */
export async function retryFailedChecks(scope: CheckScope): Promise<number> {
  const result = await prisma.lead.updateMany({
    where: { ...scopeWhere(scope), checkState: 'error' },
    data: { checkState: 'pending', checkError: null },
  })
  return result.count
}

const draining = new Set<string>()

/** Revisa la base completa en segundo plano, con un tope de tiempo. */
export async function drainSiteChecks(scope: CheckScope): Promise<void> {
  const key = `${scope.userId}:${scope.jobId ?? 'all'}`
  if (draining.has(key)) return
  draining.add(key)
  try {
    await processSiteChecks(scope, { maxLeads: Infinity, concurrency: DRAIN_CONCURRENCY, until: Date.now() + DRAIN_BUDGET_MS })
  } finally {
    draining.delete(key)
  }
}

/**
 * Agenda la revisión para después de responder. Fuera de una petición (un script, por
 * ejemplo) `after` no está disponible y se lanza directamente.
 */
export function scheduleSiteChecks(scope: CheckScope): void {
  const run = () =>
    drainSiteChecks(scope).catch((error) => console.error('[site-check] background drain failed:', error))
  try {
    after(run)
  } catch {
    void run()
  }
}

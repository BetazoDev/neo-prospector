import fs from 'node:fs'
import path from 'node:path'
import type { ClaimedLead } from '../api.js'
import { brief } from '../briefs.js'
import { runAgent } from '../claude.js'

export interface Audit {
  eligible: boolean
  score: number
  reasons: string[]
  hook: string
  summary: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['eligible', 'score', 'reasons', 'hook', 'summary'],
  properties: {
    eligible: { type: 'boolean', description: 'Si el sitio justifica preparar una demo' },
    score: { type: 'integer', minimum: 0, maximum: 100, description: 'Qué tan urgente es el rediseño' },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'Razones concretas y verificables, en español' },
    hook: { type: 'string', description: 'Una observación verdadera para el primer mensaje' },
    summary: { type: 'string', description: 'Una o dos frases sobre el sitio actual' },
  },
}

/** Mira las capturas y decide si vale la pena investigar y construir. */
export async function auditSite(lead: ClaimedLead, dir: string, onProgress: (t: string) => void): Promise<Audit> {
  const issues = (lead.siteIssues ?? []).filter((i) => i.weight > 0).map((i) => i.label)
  const { output } = await runAgent<Audit>({
    label: 'Auditoría',
    prompt: brief('audit', {
      NAME: lead.title,
      CATEGORY: lead.category,
      CITY: lead.city,
      WEBSITE: lead.website,
      DIR: dir,
      CHECK_ISSUES: issues.length ? issues.join('; ') : 'sin problemas evidentes',
    }),
    cwd: dir,
    allowedTools: ['Read', 'Glob', 'Grep'],
    disallowedTools: ['Bash', 'WebSearch', 'WebFetch', 'Write', 'Edit'],
    schema: SCHEMA,
    model: 'sonnet',
    maxTurns: 25,
    timeoutMs: 12 * 60_000,
    writableDirs: [dir],
    onProgress,
  })
  fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(output, null, 1))
  return output
}

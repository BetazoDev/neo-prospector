import fs from 'node:fs'
import path from 'node:path'
import type { ClaimedLead } from '../api.js'
import { brief } from '../briefs.js'
import { AgentError, runAgent } from '../claude.js'
import { config } from '../config.js'

export interface ResearchSummary {
  viability: 'full' | 'thin' | 'social-only' | 'dead' | 'not-a-business'
  name: string
  whatsapp: { number: string | null; confidence: 'alta' | 'media' | 'baja' | 'ninguno'; source: string | null }
  logoUsable: boolean
  doubts: string[]
  summary: string
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['viability', 'name', 'whatsapp', 'logoUsable', 'doubts', 'summary'],
  properties: {
    viability: { type: 'string', enum: ['full', 'thin', 'social-only', 'dead', 'not-a-business'] },
    name: { type: 'string' },
    whatsapp: {
      type: 'object',
      additionalProperties: false,
      required: ['number', 'confidence', 'source'],
      properties: {
        number: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['alta', 'media', 'baja', 'ninguno'] },
        source: { type: ['string', 'null'] },
      },
    },
    logoUsable: { type: 'boolean' },
    doubts: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    summary: { type: 'string' },
  },
}

/** Investigación completa del negocio: su sitio, Google, redes, directorios y Wayback. */
export async function researchBusiness(
  lead: ClaimedLead,
  dir: string,
  slug: string,
  findings: string,
  onProgress: (t: string) => void
): Promise<ResearchSummary> {
  const T = config.toolsDir
  const PY = config.python
  const { output } = await runAgent<ResearchSummary>({
    label: 'Investigación',
    prompt: brief('research', {
      NAME: lead.title,
      CATEGORY: lead.category,
      CITY: lead.city,
      ADDRESS: lead.address,
      PHONE: lead.phone,
      RATING: lead.rating ? `${lead.rating} (${lead.reviewsCount ?? 0} reseñas)` : null,
      WEBSITE: lead.website ?? 'no tiene sitio propio',
      MAPS_URL: lead.mapsUrl,
      FINDINGS: findings,
      DIR: dir,
      TOOLS: T,
      PY,
      SLUG: slug,
      LEAD_ID: lead.id,
    }),
    cwd: dir,
    additionalDirectories: [T],
    allowedTools: [
      'Read',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      `Write(${dir}/**)`,
      `Edit(${dir}/**)`,
      `Bash(node ${T}/page.mjs *)`,
      `Bash(${PY} ${T}/logo_tools.py *)`,
      `Bash(${PY} ${T}/img_prep.py *)`,
      'Bash(sips *)',
      'Bash(curl -sL *)',
      'Bash(curl -s *)',
      'Bash(higgsfield generate *)',
      'Bash(ls *)',
      'Bash(mkdir *)',
      'Bash(file *)',
      'Bash(python3 -c *)',
      `Bash(cp ${dir}/*)`,
      `Bash(mv ${dir}/*)`,
      `Bash(rm ${dir}/*)`,
    ],
    schema: SCHEMA,
    maxTurns: 260,
    timeoutMs: 80 * 60_000,
    writableDirs: [dir],
    onProgress,
  })

  const brandFile = path.join(dir, 'brand.json')
  try {
    JSON.parse(fs.readFileSync(brandFile, 'utf8'))
  } catch {
    throw new AgentError('Investigación: no dejó un brand.json válido', true)
  }
  fs.writeFileSync(path.join(dir, 'research-summary.json'), JSON.stringify(output, null, 1))
  return output
}

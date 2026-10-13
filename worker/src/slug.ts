import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import type { ClaimedLead } from './api.js'

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Rutas que ya existen en el sitio de demos (lista 1, lista 2 y demos del Prospector). */
function takenSlugs(): Set<string> {
  const taken = new Set<string>()
  const add = (dir: string) => {
    try {
      for (const name of fs.readdirSync(dir)) taken.add(name.replace(/^\d+-/, ''))
    } catch {
      // Una carpeta que no existe no aporta rutas.
    }
  }
  add(path.join(config.portafolioDir, 'astro/src/pages'))
  add(path.join(config.portafolioDir, 'src/app/(sitios)'))
  add(path.join(config.portafolioDir, 'public/sitios'))
  add(config.demosDir)
  for (const reserved of ['acceso', 'contacto', 'api', 'thumbs', 'sitios', '_a', '_l2', '_next']) taken.add(reserved)
  return taken
}

/**
 * Ruta de la demo: el dominio del negocio sin extensión (como en la lista 2), o su nombre si
 * no tiene sitio. Si ya existe, se le agrega la ciudad o un número.
 */
export function slugFor(lead: ClaimedLead): string {
  const fromDomain = lead.domain
    ?.split('/')[0]
    .replace(/^www\./, '')
    .replace(/\.(com\.mx|org\.mx|gob\.mx|edu\.mx|net\.mx|com|mx|org|net|co|site|online|info|biz)$/, '')
    .replace(/\.(wixsite|godaddysites|webnode|blogspot|business)$/, '')
  const base = fold(fromDomain && !/^sites\.google/.test(fromDomain) ? fromDomain : lead.title)
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32) || `negocio${lead.id}`

  const taken = takenSlugs()
  if (!taken.has(base)) return base
  const city = fold(lead.city?.split(',')[0] ?? '').replace(/[^a-z0-9]+/g, '').slice(0, 12)
  if (city && !taken.has(`${base}${city}`)) return `${base}${city}`
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}${i}`)) return `${base}${i}`
  return `${base}${lead.id}`
}

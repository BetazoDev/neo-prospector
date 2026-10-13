import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BRIEFS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'briefs')

/** Lee un brief y rellena sus {{VARIABLES}}. Una variable sin valor es un error, no un hueco. */
export function brief(name: 'audit' | 'research' | 'build', vars: Record<string, string | number | null | undefined>): string {
  const text = fs.readFileSync(path.join(BRIEFS, `${name}.md`), 'utf8')
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`El brief ${name} usa {{${key}}} y no tiene valor`)
    const value = vars[key]
    return value === null || value === undefined || value === '' ? 'no disponible' : String(value)
  })
}

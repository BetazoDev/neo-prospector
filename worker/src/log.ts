import fs from 'node:fs'
import path from 'node:path'

function stamp() {
  return new Date().toLocaleString('es-MX', { hour12: false })
}

export function log(scope: string, message: string) {
  console.log(`${stamp()} [${scope}] ${message}`)
}

/** Bitácora de un trabajo: a la consola y a <carpeta>/worker.log. */
export function jobLogger(scope: string, dir: string | null) {
  return (message: string) => {
    log(scope, message)
    if (!dir) return
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(path.join(dir, 'worker.log'), `${stamp()} ${message}\n`)
    } catch {
      // La bitácora en disco es una ayuda, no debe tumbar el trabajo.
    }
  }
}

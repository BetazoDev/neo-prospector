import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'

/**
 * Todo proceso que lanza el worker (agentes, compilaciones, git, servidores de Astro) va en su
 * propio grupo. Un Ctrl+C en la terminal le llega a todo el grupo de la terminal; así solo lo
 * recibe el worker, que decide si espera a los trabajos en curso o los devuelve a la cola, en
 * lugar de que cada agente o compilación muera por su cuenta a la mitad.
 */

const groups = new Set<number>()

function track<T extends ChildProcess>(child: T): T {
  const pid = child.pid
  if (pid) {
    groups.add(pid)
    child.once('exit', () => groups.delete(pid))
  }
  return child
}

/** Mata los grupos que sigan vivos (el agente y lo que él haya lanzado). */
export function killAllGroups(signal: NodeJS.Signals = 'SIGKILL') {
  for (const pid of groups) {
    try {
      process.kill(-pid, signal)
    } catch {
      // Ya terminó.
    }
  }
}

// Si el worker sale, nada de lo suyo queda corriendo huérfano.
process.on('exit', () => killAllGroups())

export function start(command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
  return track(spawn(command, args, { ...options, detached: true }))
}

export interface RunError extends Error {
  stdout: string
  stderr: string
  code: number | null
}

/** Como execFile, en su propio grupo. El error trae stdout, stderr y la última línea de error. */
export function run(
  command: string,
  args: string[],
  { cwd, timeout = 120_000, maxBuffer = 20 * 1024 * 1024 }: { cwd?: string; timeout?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = start(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => {
      stdout = (stdout + d.toString('utf8')).slice(-maxBuffer)
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString('utf8')).slice(-maxBuffer)
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      if (child.pid) process.kill(-child.pid, 'SIGTERM')
    }, timeout)
    const fail = (message: string, code: number | null) => reject(Object.assign(new Error(message), { stdout, stderr, code }) as RunError)
    child.on('error', (e) => {
      clearTimeout(timer)
      fail(`${command}: ${e.message}`, null)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) return resolve({ stdout, stderr })
      const last = stderr.trim().split('\n').slice(-2).join(' · ') || stdout.trim().split('\n').slice(-1)[0] || ''
      const why = timedOut ? `se agotó el tiempo (${Math.round(timeout / 1000)} s)` : `terminó con ${code ?? signal}`
      fail(`${command} ${args.slice(0, 2).join(' ')} ${why}${last ? `: ${last.slice(0, 240)}` : ''}`, code)
    })
  })
}

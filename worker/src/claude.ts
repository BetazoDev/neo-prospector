import { AbortError, query, type Options, type SpawnedProcess } from '@anthropic-ai/claude-agent-sdk'
import os from 'node:os'
import { config } from './config.js'
import { start } from './proc.js'

/** El plan de Claude llegó a su límite: el worker pausa hasta esa hora y reintenta. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly resetAt: Date
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

/** Claude no tiene sesión (token vencido o ausente): ningún trabajo puede avanzar hasta arreglarlo. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class AgentError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

export interface AgentRun {
  /** Para la bitácora: "auditoría", "investigación"... */
  label: string
  prompt: string
  cwd: string
  additionalDirectories?: string[]
  allowedTools: string[]
  disallowedTools?: string[]
  /** Esquema JSON (draft-07) de la respuesta final. */
  schema?: Record<string, unknown>
  model?: string
  maxTurns: number
  timeoutMs: number
  /** Carpetas donde el sandbox (si está activo) deja escribir. */
  writableDirs: string[]
  onProgress?: (text: string) => void
}

export interface AgentResult<T> {
  output: T
  text: string
  sessionId: string
  turns: number
  costUsd: number
}

/**
 * Entorno de los agentes: el del worker sin los secretos que no les tocan. WORKER_TOKEN
 * nunca llega a un agente; la credencial de Claude que no se usa tampoco, para que no gane
 * la precedencia equivocada (una ANTHROPIC_API_KEY suelta tiene prioridad sobre el plan).
 */
function agentEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) if (typeof value === 'string') env[key] = value
  delete env.WORKER_TOKEN
  if (config.auth === 'plan') delete env.ANTHROPIC_API_KEY
  else delete env.CLAUDE_CODE_OAUTH_TOKEN
  return env
}

const RATE_LIMIT = /rate.?limit|usage limit|limit reached|too many requests|\b429\b|overloaded/i
const NO_AUTH = /not logged in|please run \/login|invalid api key|invalid (bearer|oauth) token|oauth token (has )?expired|authentication_error|unauthori[sz]ed|\b401\b/i
const AUTH_HELP = 'Claude no tiene sesión en esta Mac. Genera un token con `claude setup-token` y ponlo en worker/.env como CLAUDE_CODE_OAUTH_TOKEN'


/** "resets at 3pm", "reset in 2 hours"... si no se entiende, una hora. */
function resetFrom(text: string): Date {
  const now = Date.now()
  const inHours = text.match(/in\s+(\d+)\s*h/i)
  if (inHours) return new Date(now + Number(inHours[1]) * 3600_000)
  const inMinutes = text.match(/in\s+(\d+)\s*m/i)
  if (inMinutes) return new Date(now + Number(inMinutes[1]) * 60_000)
  const at = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (at) {
    let h = Number(at[1]) % 12
    if (at[3].toLowerCase() === 'pm') h += 12
    const d = new Date()
    d.setHours(h, Number(at[2] ?? 0), 0, 0)
    if (d.getTime() <= now) d.setDate(d.getDate() + 1)
    return d
  }
  return new Date(now + 3600_000)
}

/** Agentes en curso, para detenerlos todos si el worker se apaga a media tarea. */
const active = new Set<AbortController>()

export function abortAllAgents() {
  for (const controller of active) controller.abort()
}

function describeTool(name: string, input: Record<string, unknown>): string | null {
  const short = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').slice(0, 90)
  if (name === 'WebSearch') return `Busca: ${short(input.query)}`
  if (name === 'WebFetch') return `Lee: ${short(input.url)}`
  if (name === 'Bash') return `Ejecuta: ${short(input.description || input.command)}`
  if (name === 'Write') return `Escribe: ${short(input.file_path).split('/').slice(-2).join('/')}`
  return null
}

export async function runAgent<T>(run: AgentRun): Promise<AgentResult<T>> {
  const abort = new AbortController()
  active.add(abort)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    abort.abort()
  }, run.timeoutMs)
  let lastProgress = 0
  let stderrTail = ''

  const options: Options = {
    cwd: run.cwd,
    additionalDirectories: run.additionalDirectories,
    allowedTools: run.allowedTools,
    disallowedTools: ['Bash(sudo *)', 'Bash(git push *)', 'Bash(ssh *)', 'Bash(scp *)', ...(run.disallowedTools ?? [])],
    // Sin nadie frente a la pantalla: lo que no está en allowedTools se niega, no se pregunta.
    permissionMode: 'dontAsk',
    model: run.model,
    maxTurns: run.maxTurns,
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    // Ni hooks ni CLAUDE.md de la máquina: el brief trae todo lo que el agente necesita.
    settingSources: [],
    abortController: abort,
    env: agentEnv(),
    // En su propio grupo de procesos (ver proc.ts): solo el worker decide cuándo detenerlo.
    spawnClaudeCodeProcess: ({ command, args, cwd, env, signal }) => {
      const child = start(command, args, { cwd, env, signal, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      child.stderr?.on('data', (d: Buffer) => {
        stderrTail = (stderrTail + d.toString('utf8')).slice(-3000)
      })
      return child as unknown as SpawnedProcess
    },
    ...(run.schema ? { outputFormat: { type: 'json_schema', schema: run.schema } } : {}),
    ...(config.sandbox
      ? {
          sandbox: {
            enabled: true,
            autoAllowBashIfSandboxed: true,
            allowUnsandboxedCommands: false,
            filesystem: {
              allowWrite: [...run.writableDirs, os.tmpdir()],
              denyRead: ['~/.ssh', '~/.aws', '~/.config/gh', '~/Library/Keychains'],
            },
            network: { allowLocalBinding: true },
          },
        }
      : {}),
  }

  try {
    for await (const message of query({ prompt: run.prompt, options })) {
      if (message.type === 'system' && message.subtype === 'init') {
        run.onProgress?.(`${run.label}: sesión ${message.session_id.slice(0, 8)} con ${message.model}`)
      }
      if (message.type === 'assistant' && run.onProgress) {
        for (const block of message.message.content) {
          if (block.type !== 'tool_use') continue
          const text = describeTool(block.name, block.input as Record<string, unknown>)
          // Una línea cada 90 s basta para ver que avanza sin llenar la ficha.
          if (text && Date.now() - lastProgress > 90_000) {
            lastProgress = Date.now()
            run.onProgress(`${run.label} · ${text}`)
          }
        }
      }
      if (message.type !== 'result') continue

      if (message.subtype === 'success' && !message.is_error) {
        const output = (run.schema ? message.structured_output : message.result) as T
        if (run.schema && output === undefined) throw new AgentError(`${run.label}: el agente terminó sin la respuesta estructurada`, true)
        return { output, text: message.result, sessionId: message.session_id, turns: message.num_turns, costUsd: message.total_cost_usd }
      }

      const detail = message.subtype === 'success' ? message.result : message.errors.join(' · ')
      const status = (message as { api_error_status?: number }).api_error_status
      if (NO_AUTH.test(detail) || status === 401) throw new AuthError(`${run.label}: ${AUTH_HELP} (${detail.slice(0, 120)})`)
      if (RATE_LIMIT.test(detail) || status === 429) {
        throw new RateLimitError(`${run.label}: el plan de Claude llegó a su límite (${detail.slice(0, 160)})`, resetFrom(detail))
      }
      const retryable = message.subtype !== 'error_max_turns' && message.subtype !== 'error_max_budget_usd'
      throw new AgentError(`${run.label}: ${message.subtype} ${detail}`.slice(0, 400), retryable)
    }
    throw new AgentError(`${run.label}: el agente terminó sin resultado`, true)
  } catch (error) {
    if (error instanceof AbortError || abort.signal.aborted) {
      throw new AgentError(timedOut ? `${run.label}: se agotó el tiempo (${Math.round(run.timeoutMs / 60000)} min)` : `${run.label}: detenido`, true)
    }
    if (error instanceof RateLimitError || error instanceof AgentError || error instanceof AuthError) throw error
    const text = `${error instanceof Error ? error.message : String(error)} ${stderrTail.trim().split('\n').slice(-3).join(' · ')}`.trim()
    if (RATE_LIMIT.test(text)) throw new RateLimitError(`${run.label}: límite del plan (${text.slice(0, 160)})`, resetFrom(text))
    if (NO_AUTH.test(text)) throw new AuthError(`${run.label}: ${AUTH_HELP}`)
    throw new AgentError(`${run.label}: ${text}`.slice(0, 400), true)
  } finally {
    clearTimeout(timer)
    active.delete(abort)
  }
}

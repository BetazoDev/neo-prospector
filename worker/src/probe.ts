import { runAgent } from './claude.js'
import { config } from './config.js'
import { log } from './log.js'

/**
 * `npm run probe`: comprueba que Claude responde con la credencial de worker/.env (o la sesión
 * de `claude login`) antes de dejar el worker corriendo. Usa una sola vuelta de Haiku.
 */
const started = Date.now()
try {
  const { output, sessionId, costUsd } = await runAgent<{ ok: boolean; model: string }>({
    label: 'Prueba',
    prompt: 'Responde con ok=true y el nombre del modelo que eres en `model`. No uses herramientas.',
    cwd: config.demosDir,
    allowedTools: [],
    disallowedTools: ['Bash', 'Read', 'Write', 'Edit', 'WebSearch', 'WebFetch', 'Glob', 'Grep'],
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'model'],
      properties: { ok: { type: 'boolean' }, model: { type: 'string' } },
    },
    model: 'haiku',
    maxTurns: 3,
    timeoutMs: 120_000,
    writableDirs: [],
    onProgress: (t) => log('probe', t),
  })
  log(
    'probe',
    `Claude responde (${config.auth === 'plan' ? 'plan' : 'API key'}): ${output.model}, sesión ${sessionId.slice(0, 8)}, ${((Date.now() - started) / 1000).toFixed(1)} s${config.auth === 'api-key' ? `, US$${costUsd.toFixed(4)}` : ''}`
  )
} catch (error) {
  log('probe', `Claude no respondió: ${(error as Error).message}`)
  process.exitCode = 1
}

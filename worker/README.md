# Worker de demos (Mac)

El Prospector en Dokploy guarda la cola de demos; este worker corre en la Mac, pide trabajos por la API y hace el trabajo pesado con Claude Code en modo headless. Cada negocio candidato pasa por cinco pasos:

1. **Extracción** del sitio actual: capturas a 1440, marca, textos, subpáginas y recursos (Playwright con Chrome).
2. **Auditoría visual** (Sonnet): mira las capturas y decide si el sitio amerita una demo. Si dice que no, el negocio queda como «sitio aceptable» y no se vuelve a intentar solo en 30 días.
3. **Investigación completa** (obligatoria antes de construir): Google, redes, directorios, Wayback. Deja `brand.json`, el WhatsApp con su nivel de confianza y las dudas.
4. **Construcción** en una copia aislada del proyecto Astro de la lista 2 (`mkwork.sh`), con verificación visual a 1440 y 390.
5. **Publicación** en el repositorio de demos (BetazoDev/demos, que Dokploy despliega): compila el sitio completo, genera la miniatura, hace commit solo de sus archivos y push a `main`.

Cada paso deja sus archivos en `DEMOS_DIR/<slug>/`, así que un reintento retoma desde el último paso terminado en lugar de repetir horas de investigación. La ficha del negocio en el Prospector muestra cada paso, la bitácora y el enlace de la demo.

## Requisitos en la Mac

- Node 22 o más reciente, pnpm, git con permiso de push a BetazoDev/demos, y Google Chrome.
- La copia del repositorio de demos en `~/Claude/portafolio`, en `main`, con `pnpm install` hecho en `astro/`.
- Las herramientas de la lista 2 en `~/Claude/lista-2/_tools`: `mkwork.sh`, `inpage.js`, `page.mjs`, `shot.mjs`, los scripts de Python con su `venv`, `fonts-used.txt` y `directions-chosen.txt`.
- Opcional: la CLI de Higgsfield autenticada, para imágenes de ambiente cuando el negocio no tiene fotos propias.

## Instalación

```bash
cd worker
npm install
cp .env.example .env
```

En `.env`:

- `PROSPECTOR_URL`: la URL del Prospector en Dokploy.
- `WORKER_TOKEN`: un secreto largo (por ejemplo `openssl rand -hex 24`). **El mismo valor** va en las variables de entorno del Prospector en Dokploy; sin él, la API del worker responde 503.
- `CLAUDE_CODE_OAUTH_TOKEN`: el token de tu plan de Claude. Se genera una vez (dura un año):

  ```bash
  npx @anthropic-ai/claude-code setup-token
  ```

  (o `claude setup-token` si ya tienes la CLI de Claude Code instalada). La sesión de la app de escritorio no sirve: el worker necesita este token.

- `CONCURRENCY`: cuántas demos a la vez (4 por omisión). Cada una usa su propio agente y su propio par de puertos desde `BASE_PORT`.

Comprueba que Claude responde con esa credencial:

```bash
npm run probe
```

## Uso

```bash
npm start                   # en marcha continua
npm run once                # toma un trabajo, lo termina y sale
npm start -- --dry-run      # solo extrae y devuelve el trabajo a la cola, sin usar Claude
```

Para la primera demo, pon `PUBLISH=false` y corre `npm run once`: hace todo menos el push y deja el sitio en `~/Claude/lista-2/_work/prospector-<slug>`. Revísalo, cambia a `PUBLISH=true`, reinicia el worker (lee `.env` al arrancar) y pide la demo otra vez desde la ficha («Reintentar la demo»): retoma con lo ya construido y solo publica.

Para que la Mac no se duerma mientras trabaja:

```bash
caffeinate -i npm start
```

**Detenerlo:** un Ctrl+C deja de tomar trabajos y espera a que terminen los que van en curso. Un segundo Ctrl+C (o un `kill`, que manda SIGTERM) los devuelve a la cola sin gastar un intento, detiene a los agentes y sale; al volver a arrancar se retoman del último paso. Si una publicación está a la mitad, espera a que termine para no dejar el repositorio de demos a medias.

## Qué pasa cuando algo falla

| Situación | Qué hace el worker |
|---|---|
| El plan de Claude llega a su límite | Devuelve el trabajo sin gastar intento y pausa hasta la hora que indica Claude. La barra de actividad lo muestra. |
| Claude no tiene sesión (token vencido o ausente) | Devuelve el trabajo, pausa 30 minutos y la barra de actividad pide generar el token. |
| El repositorio de demos tiene cambios sin commitear, commits sin subir o no está en `main` | No toca nada: devuelve el trabajo y reintenta en 15 minutos. |
| La compilación de Astro falla con la demo | Deshace la copia, guarda el error y en el siguiente intento un agente corrige solo eso, sin reconstruir. |
| Cualquier otro error | Reintenta hasta 3 veces en total; después la demo queda como fallida y la ficha ofrece «Reintentar la demo». |
| La auditoría dice que el sitio está bien | La ficha ofrece «Preparar de todos modos», que construye sin ese filtro. |

Un trabajo cuyo worker deja de dar señales 25 minutos vuelve solo a la cola (por ejemplo, si la Mac se apagó).

## Lo que toca en el repositorio de demos

La primera publicación agrega la lista del Prospector al sitio de demos: crea `src/data/sites3.ts` (el registro que mantiene el worker) y añade a `next.config.ts` y `src/app/page.tsx` sus rutas y la pestaña «Prospector». Si esos archivos cambiaron y los anclajes no coinciden, se detiene en lugar de parchear a ciegas. Cada demo después agrega `astro/src/sites/<slug>/`, `astro/src/pages/<slug>/`, su miniatura `public/thumbs/p-<slug>.webp` y su línea en `sites3.ts`, en un commit propio. El repositorio es público y cada push a `main` se despliega solo.

## Seguridad

- Cada agente tiene solo las herramientas de su paso: lectura, escritura en la carpeta del negocio o en su copia de trabajo, y una lista cerrada de comandos. Nunca `git push`, `ssh` ni `sudo`; el push lo hace el worker después de compilar.
- `WORKER_TOKEN` nunca llega a los agentes, y la credencial de Claude que no se usa tampoco.
- Los briefs tratan todo lo que viene de la web como datos, no como instrucciones.
- `WORKER_SANDBOX=true` corre además a los agentes dentro del sandbox de Claude Code, que limita la escritura a sus carpetas.

## Plan o API key

Con `WORKER_AUTH=plan` el worker usa tu plan de Claude: el uso cuenta contra sus límites y está pensado para tu propio trabajo. Si el Prospector llega a usarse por varios vendedores o a otra escala, cambia a `WORKER_AUTH=api-key` con `ANTHROPIC_API_KEY`, que se cobra por uso.

## Variables del Prospector (Dokploy)

- `WORKER_TOKEN` (obligatoria para activar la cola de demos).
- `DEMOS_BASE_URL` (opcional, `https://demos.diabolicalservices.tech/` por omisión): el prospector solo acepta enlaces de demo de ese sitio.
- `DEMO_AUTO_QUEUE=false` (opcional): los candidatos nuevos ya no entran solos a la cola; se piden desde la base o la ficha.

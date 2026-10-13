'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import AppShell, { useShell } from './components/shell/AppShell'
import BaseRow, { type FieldBase } from './components/BaseRow'
import DotField from './components/DotField'
import SearchComposer, { type SearchComposerHandle } from './components/SearchComposer'

const LEGEND = [
  { state: 'c', label: 'Candidato' },
  { state: 'u', label: 'Revisión manual' },
  { state: 'o', label: 'Sitio aceptable' },
  { state: 'n', label: 'Sin sitio' },
  { state: 'r', label: 'Revisando' },
]

/** Campo de muestra para el estado vacío: así se ve una base cuando ya está revisada. */
const SAMPLE = 'ccooncpocnoucoonncocopoonccocnooucnocpoocconnoc'

function Home() {
  const { openImport, refresh: refreshShell } = useShell()
  const [bases, setBases] = useState<FieldBase[] | null>(null)
  const [maxLeads, setMaxLeads] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const composer = useRef<SearchComposerHandle>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/fields?limit=6')
      if (res.ok) {
        setBases((await res.json()).bases)
        setNow(Date.now())
      }
    } catch {
      // El siguiente sondeo lo vuelve a intentar.
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(load, 0)
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => s?.maxLeads && setMaxLeads(s.maxLeads))
      .catch(() => undefined)
    // Desde la búsqueda global, "Nueva búsqueda" llega aquí con ?nueva=1.
    if (new URLSearchParams(window.location.search).get('nueva')) composer.current?.focus()
    return () => clearTimeout(first)
  }, [load])

  // Mientras alguna base se busca o se revisa, el campo se refresca para verla llenarse.
  const live = !!bases?.some((b) => b.status === 'running' || b.status === 'importing' || /[pr]/.test(b.dots))
  useEffect(() => {
    if (!live) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [live, load])

  return (
    <section className="home field-carbon">
      <div className="page home-grid">
        <div>
          <h1 className="display home-title">
            ¿Qué negocios
            <span className="dim">buscamos hoy?</span>
          </h1>
          <p className="home-lede">
            Escribe un giro y una zona. Buscamos en Google Maps y revisamos el sitio de cada negocio para decirte a quién le hace falta uno nuevo.
          </p>
          <SearchComposer
            ref={composer}
            maxLeads={maxLeads}
            onStarted={() => {
              load()
              refreshShell()
            }}
            onFinished={() => {
              load()
              refreshShell()
            }}
            onImport={openImport}
          />
        </div>

        <div>
          <div className="section-head">
            <h2 className="section-title">Tus bases</h2>
            <div className="mini-legend" aria-label="Qué significa cada punto">
              {LEGEND.map((item) => (
                <span key={item.state}>
                  <span className={`dot dot-${item.state}`} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {bases === null && (
            <div className="base-rows" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="base-row">
                  <div>
                    <div className="skeleton" style={{ width: 180, height: 22 }} />
                    <div className="skeleton" style={{ width: 120, height: 12, marginTop: 10 }} />
                  </div>
                  <div className="skeleton" style={{ height: 40 }} />
                  <div className="skeleton" style={{ width: 48, height: 32, marginLeft: 'auto' }} />
                </div>
              ))}
            </div>
          )}

          {bases?.length === 0 && (
            <div className="empty-bases">
              <h3>Aquí aparece cada búsqueda</h3>
              <p>
                Cada negocio que encontremos será un punto. Se pinta de carmesí cuando su sitio necesita un rediseño, así ves de un vistazo
                dónde hay trabajo.
              </p>
              <DotField dots={SAMPLE} label="Ejemplo de una base revisada" />
            </div>
          )}

          {bases && bases.length > 0 && (
            <>
              <div className="base-rows">
                {bases.map((base) => (
                  <BaseRow key={base.id} base={base} now={now} variant="feature" dotSize="lg" />
                ))}
              </div>
              <Link href="/bases" className="btn btn-ghost btn-sm" style={{ marginTop: 20 }}>
                Ver todas las bases <ArrowRight aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <AppShell active="inicio">
      <Home />
    </AppShell>
  )
}

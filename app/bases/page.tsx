'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Upload } from 'lucide-react'
import AppShell, { useShell } from '../components/shell/AppShell'
import BaseRow, { baseTitle, type FieldBase } from '../components/BaseRow'

const DAY = 24 * 60 * 60 * 1000

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function Bases() {
  const { openImport, toast, refresh: refreshShell } = useShell()
  const [bases, setBases] = useState<FieldBase[] | null>(null)
  const [filter, setFilter] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/fields')
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
    return () => clearTimeout(first)
  }, [load])

  const live = !!bases?.some((b) => b.status === 'running' || b.status === 'importing' || /[pr]/.test(b.dots))
  useEffect(() => {
    if (!live) return
    const timer = setInterval(load, 4000)
    return () => clearInterval(timer)
  }, [live, load])

  const groups = useMemo(() => {
    const q = fold(filter.trim())
    const list = (bases ?? []).filter((b) => !q || fold(`${baseTitle(b)} ${b.niche} ${b.zone}`).includes(q))
    const age = (b: FieldBase) => now - new Date(b.createdAt).getTime()
    return [
      { title: 'Últimos 7 días', items: list.filter((b) => age(b) <= 7 * DAY) },
      { title: 'Últimos 30 días', items: list.filter((b) => age(b) > 7 * DAY && age(b) <= 30 * DAY) },
      { title: 'Anteriores', items: list.filter((b) => age(b) > 30 * DAY) },
    ].filter((g) => g.items.length > 0)
  }, [bases, filter, now])

  const totalLeads = (bases ?? []).reduce((sum, b) => sum + b.total, 0)

  const rename = async (base: FieldBase) => {
    const name = window.prompt('Nuevo nombre de la base', baseTitle(base))?.trim()
    if (!name || name === baseTitle(base)) return
    const res = await fetch(`/api/jobs?id=${base.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      toast('Base renombrada', name)
      load()
      refreshShell()
    } else toast('No se pudo renombrar', 'Intenta de nuevo.', 'error')
  }

  const remove = async (base: FieldBase) => {
    if (!window.confirm(`¿Eliminar «${baseTitle(base)}» y sus ${base.total} negocios? No se puede deshacer.`)) return
    const res = await fetch(`/api/jobs?id=${base.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Base eliminada', baseTitle(base))
      load()
      refreshShell()
    } else toast('No se pudo eliminar', 'Intenta de nuevo.', 'error')
  }

  return (
    <section className="field-carbon" style={{ minHeight: 'calc(100svh - 109px)' }}>
      <div className="page page-head">
        <div className="page-title-row">
          <div>
            <h1 className="display page-title">Bases</h1>
            <div className="page-meta">
              {bases && (
                <>
                  <span>
                    <strong>{bases.length.toLocaleString('es-MX')}</strong> {bases.length === 1 ? 'búsqueda' : 'búsquedas'}
                  </span>
                  <span>
                    <strong>{totalLeads.toLocaleString('es-MX')}</strong> {totalLeads === 1 ? 'negocio' : 'negocios'}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="page-actions">
            <div className="search-box" style={{ position: 'relative', width: 260 }}>
              <Search aria-hidden="true" style={{ position: 'absolute', left: 14, top: 12, width: 15, height: 15, color: 'var(--on-dark-3)' }} />
              <input
                className="input"
                style={{ paddingLeft: 38, borderRadius: 999 }}
                placeholder="Filtrar bases"
                aria-label="Filtrar bases"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={openImport}>
              <Upload aria-hidden="true" /> Importar CSV
            </button>
            <Link href="/?nueva=1" className="btn btn-primary">
              <Plus aria-hidden="true" /> Nueva búsqueda
            </Link>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingBottom: 80 }}>
        {bases === null && <div className="skeleton" style={{ height: 120 }} aria-hidden="true" />}
        {bases?.length === 0 && (
          <div className="empty-bases">
            <h3>Todavía no hay bases</h3>
            <p>Cada búsqueda que lances desde el inicio queda aquí, con todos sus negocios como puntos.</p>
            <Link href="/?nueva=1" className="btn btn-primary" style={{ marginTop: 20 }}>
              Lanzar la primera búsqueda
            </Link>
          </div>
        )}
        {bases && bases.length > 0 && groups.length === 0 && (
          <p className="section-note">Ninguna base coincide con «{filter.trim()}».</p>
        )}
        {groups.map((group) => (
          <div key={group.title} style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ fontSize: 20, color: 'var(--on-dark-2)', marginBottom: 8 }}>
              {group.title}
            </h2>
            <div className="base-rows">
              {group.items.map((base) => (
                <BaseRow key={base.id} base={base} now={now} onRename={rename} onDelete={remove} dotSize="lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function BasesPage() {
  return (
    <AppShell active="bases">
      <Bases />
    </AppShell>
  )
}

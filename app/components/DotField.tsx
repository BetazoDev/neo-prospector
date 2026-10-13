'use client'

import { memo, useMemo, useRef, useState } from 'react'
import { DOT_STATES, type DotState } from '@/lib/pipeline/dots'

interface DotFieldProps {
  /** Una letra por negocio, en orden de llegada (ver lib/pipeline/dots.ts). */
  dots: string
  /** Mismo orden que `dots`. Con ellos el campo muestra el nombre al pasar y abre al hacer clic. */
  items?: { id: number; t: string }[]
  size?: 'sm' | 'md' | 'lg'
  /** Negocios que no caben en el campo; se anuncian al final. */
  hidden?: number
  /** Punto resaltado, por ejemplo el de la fila que se señala en la lista. */
  activeId?: number | null
  /** Estados que se quedan encendidos; el resto se atenúa. */
  focus?: string | null
  onPick?: (id: number) => void
  onHover?: (id: number | null) => void
  /** Resumen para lectores de pantalla. */
  label: string
}

const Dots = memo(function Dots({
  dots,
  items,
  activeId,
  focus,
}: Pick<DotFieldProps, 'dots' | 'items' | 'activeId' | 'focus'>) {
  return (
    <>
      {Array.from(dots).map((state, i) => {
        const id = items?.[i]?.id
        const dim = focus ? !focus.includes(state) : false
        return (
          <span
            key={id ?? i}
            data-i={i}
            className={`dot dot-${state}${dim ? ' is-dim' : ''}${id !== undefined && id === activeId ? ' is-active' : ''}`}
          />
        )
      })}
    </>
  )
})

/**
 * El campo de puntos: cada negocio es un punto y su color dice en qué va. Se llena en su
 * lugar mientras se revisan los sitios, así que una base nueva se ve avanzar sin abrirla.
 */
export default function DotField({ dots, items, size = 'md', hidden = 0, activeId, focus, onPick, onHover, label }: DotFieldProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null)
  const interactive = !!items && (!!onPick || !!onHover)

  const indexFrom = (target: EventTarget | null): number | null => {
    const el = (target as HTMLElement | null)?.closest?.('[data-i]') as HTMLElement | null
    return el ? Number(el.dataset.i) : null
  }

  const handleMove = (e: React.PointerEvent) => {
    if (!interactive || e.pointerType === 'touch') return
    const i = indexFrom(e.target)
    if (i === null) return
    if (tip?.i === i) return
    const el = e.target as HTMLElement
    setTip({ i, x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop })
    onHover?.(items![i].id)
  }

  const handleLeave = () => {
    if (!tip) return
    setTip(null)
    onHover?.(null)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!interactive) return
    const i = indexFrom(e.target)
    if (i !== null) onPick?.(items![i].id)
  }

  const tipItem = tip && items?.[tip.i]
  const tipState = tip ? (dots[tip.i] as DotState) : null
  const legendText = useMemo(() => label, [label])

  return (
    <div
      ref={ref}
      className={`dotfield dotfield-${size}${interactive ? ' is-interactive' : ''}`}
      role="img"
      aria-label={legendText}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={handleClick}
    >
      <Dots dots={dots} items={items} activeId={activeId} focus={focus} />
      {hidden > 0 && <span className="dotfield-more">+{hidden.toLocaleString('es-MX')}</span>}
      {tipItem && tipState && (
        <span className="dot-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          <span className="dot-tip-name">{tipItem.t}</span>
          <span className="dot-tip-state">{DOT_STATES[tipState].label}</span>
        </span>
      )}
    </div>
  )
}

/** Resumen hablado del campo: "100 negocios: 29 candidatos, 31 con sitio aceptable…". */
export function describeDots(dots: string): string {
  const counts = new Map<DotState, number>()
  for (const ch of dots) counts.set(ch as DotState, (counts.get(ch as DotState) ?? 0) + 1)
  const parts = [...counts.entries()]
    .sort((a, b) => DOT_STATES[a[0]].order - DOT_STATES[b[0]].order)
    .map(([state, n]) => `${n} ${DOT_STATES[state].label.toLowerCase()}`)
  return `${dots.length} negocios: ${parts.join(', ')}`
}

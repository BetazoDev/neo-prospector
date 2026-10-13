'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Abre y cierra un menú flotante: se cierra al hacer clic fuera o con Esc. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const node = useRef<T | null>(null)
  // Ref de callback: el componente solo recibe una función y nunca lee la ref al renderizar.
  const anchor = useCallback((el: T | null) => {
    node.current = el
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (node.current && !node.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])
  return { open, toggle, close, anchor }
}

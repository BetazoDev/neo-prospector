'use client'

import { useSyncExternalStore } from 'react'

const TICK_MS = 30_000
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, TICK_MS)
  return () => clearInterval(timer)
}
// Redondeado al tick: la instantánea no cambia entre avisos y React no re-renderiza en bucle.
const snapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS

/** La hora actual en pasos de 30 s, para comparar fechas sin leer el reloj al renderizar. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, () => 0)
}

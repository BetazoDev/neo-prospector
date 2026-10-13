'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * Falso en el servidor y durante la hidratación, verdadero después. Lo usan las cuentas
 * que llegan del sondeo de la barra: pueden llegar antes de que React termine de hidratar
 * un límite de Suspense y no deben chocar con el HTML del servidor.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

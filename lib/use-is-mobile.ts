'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Mismo corte que usa el CSS para pasar a la disposición móvil. */
const MOBILE_QUERY = '(max-width: 768px)'

/**
 * Indica si el viewport es de tamaño móvil.
 *
 * Usa `useSyncExternalStore` en lugar de un efecto porque el servidor no conoce
 * el viewport: devuelve `false` al renderizar en servidor y React sustituye el
 * valor real al hidratar, sin desajuste de marcado ni un render extra en un
 * `useEffect`.
 */
export function useIsMobile(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const query = window.matchMedia(MOBILE_QUERY)
    query.addEventListener('change', onStoreChange)
    return () => query.removeEventListener('change', onStoreChange)
  }, [])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

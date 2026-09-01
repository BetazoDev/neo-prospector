'use client'

import { NavItem } from './Sidebar'

interface BottomNavProps {
  activeNav: NavItem
  onNavigate: (nav: NavItem) => void
}

/**
 * Navegación móvil. La barra lateral queda fuera de pantalla por debajo de 768px,
 * así que esta es la única forma de moverse por la app en un teléfono y tiene que
 * estar presente en todas las pantallas, no solo en el dashboard.
 */
export default function BottomNav({ activeNav, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <button
        type="button"
        className={`bottom-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
        onClick={() => onNavigate('dashboard')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="6" height="6" rx="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
        Inicio
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${activeNav === 'agent' ? 'active' : ''}`}
        onClick={() => onNavigate('agent')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v12M2 8h12" strokeLinecap="round" />
        </svg>
        Prospectar
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${activeNav === 'leads' ? 'active' : ''}`}
        onClick={() => onNavigate('leads')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" />
        </svg>
        Bases
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
            strokeLinecap="round"
          />
        </svg>
        Ajustes
      </button>
    </nav>
  )
}

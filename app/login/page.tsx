'use client'

import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { HemeronLogo } from '../components/HemeronLogo'

const subscribeNever = () => () => {}

/** Día del año, como el calendario de puntos de hemeron.com. En el servidor no se pinta. */
function useDayOfYear(): number {
  return useSyncExternalStore(
    subscribeNever,
    () => {
      const now = new Date()
      return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
    },
    () => 0
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('admin@diabolicalservices.tech')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const today = useDayOfYear()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim() || loading) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas')
        setLoading(false)
        return
      }

      // Success -> Redirect to dashboard
      router.push('/')
      router.refresh()
    } catch {
      setError('Error de conexión con el servidor')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-calendar" aria-hidden="true">
        {today > 0 &&
          Array.from({ length: 365 }, (_, i) => (
            <span key={i} className={i + 1 < today ? 'is-past' : i + 1 === today ? 'is-today' : undefined} />
          ))}
      </div>

      <div className="login-card">
        <HemeronLogo className="login-logo" />
        <h1 className="display login-title">Prospector</h1>
        <p className="login-sub">Encuentra negocios, revisa sus sitios y prepara su rediseño.</p>

        <form onSubmit={handleLogin} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email" className="login-label">
              Correo
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@hemeron.com"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="login-label">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>

      <p className="login-foot">Hemeron · Estudio de software a la medida</p>
    </div>
  )
}

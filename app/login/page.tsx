'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@diabolicalservices.tech')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09090b',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#121215',
          border: '1px solid #27272a',
          borderRadius: '16px',
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        }}
      >
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#ffffff',
              color: '#000000',
              fontWeight: 900,
              fontSize: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '-1px',
              marginBottom: 14,
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.2)',
            }}
          >
            NP
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.5px' }}>
            NeoProspector
          </h1>
          <p style={{ fontSize: 13, color: '#a1a1aa', marginTop: 6, margin: 0 }}>
            Plataforma Segura de Inteligencia de Leads
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: 13,
                color: '#f87171',
                lineHeight: 1.4,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#d4d4d8', marginBottom: 6 }}
            >
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@diabolicalservices.tech"
              required
              style={{
                width: '100%',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#d4d4d8', marginBottom: 6 }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%',
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            style={{
              marginTop: 10,
              width: '100%',
              height: 44,
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? 'Iniciando Sesión...' : 'Ingresar al Dashboard →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#71717a' }}>
          Diabolical Services © 2026 · Todos los derechos reservados
        </div>
      </div>
    </div>
  )
}

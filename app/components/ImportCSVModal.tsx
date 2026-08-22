'use client'

import { useState, useRef, useCallback } from 'react'

interface ImportCSVModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
}

interface PreviewRow {
  [key: string]: string
}

export default function ImportCSVModal({ isOpen, onClose, onImported }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [customName, setCustomName] = useState('')
  const [preview, setPreview] = useState<{ headers: string[]; rows: PreviewRow[] } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsePreview = (text: string) => {
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return null
    const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())
    const rows = lines.slice(1, 6).map((line) => {
      const vals = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim())
      const row: PreviewRow = {}
      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
      return row
    })
    return { headers, rows }
  }

  const handleFile = useCallback(async (f: File) => {
    setError(null)
    if (!f.name.endsWith('.csv')) {
      setError('Solo se aceptan archivos .csv')
      return
    }
    setFile(f)
    setCustomName(f.name.replace(/\.csv$/i, ''))
    const text = await f.text()
    setPreview(parsePreview(text))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (customName.trim()) formData.append('name', customName.trim())

      setProgress(40)
      const res = await fetch('/api/import', { method: 'POST', body: formData })
      setProgress(80)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al importar')
        setLoading(false)
        setProgress(0)
        return
      }

      setProgress(100)
      setTimeout(() => {
        onImported()
        handleClose()
      }, 400)
    } catch (err) {
      setError(`Error de conexión: ${String(err)}`)
      setLoading(false)
      setProgress(0)
    }
  }

  const handleClose = () => {
    setFile(null)
    setCustomName('')
    setPreview(null)
    setError(null)
    setProgress(0)
    setLoading(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 4h10M3 8h7M3 12h4" strokeLinecap="round" />
                <path d="M12 10v4M10 12l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Importar CSV</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Sube un CSV y se creará una base igual que con scraping
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 16,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent, #7c3aed)' : file ? '#10b981' : 'var(--border-default)'}`,
            borderRadius: 12,
            padding: '32px 20px',
            textAlign: 'center',
            cursor: file ? 'default' : 'pointer',
            background: isDragging
              ? 'rgba(124,58,237,0.06)'
              : file
              ? 'rgba(16,185,129,0.06)'
              : 'var(--bg-elevated)',
            transition: 'all 0.2s ease',
            marginBottom: 16,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
          {file ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(16,185,129,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="#10b981" strokeWidth="1.8" style={{ width: 24, height: 24 }}>
                  <path d="M4 4h8l4 4v8H4V4z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {(file.size / 1024).toFixed(1)} KB
                {preview ? ` · ${preview.rows.length}+ filas (preview)` : ''}
              </div>
              <button
                style={{
                  marginTop: 4,
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '4px 10px',
                }}
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setCustomName('') }}
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--bg-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.6" style={{ width: 26, height: 26 }}>
                  <path d="M10 3v10M6 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 17h14" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra un CSV o haz clic para seleccionar'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Columnas: Empresa, Teléfono, Rating, Ciudad, Dirección, Sitio Web…
              </div>
            </div>
          )}
        </div>

        {/* Custom Name */}
        {file && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Nombre de la base
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nombre que aparecerá en el grid"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Preview Table */}
        {preview && preview.rows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Vista previa ({preview.rows.length} filas)
            </div>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {preview.headers.map((h) => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < preview.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      {preview.headers.map((h) => (
                        <td key={h} style={{ padding: '5px 10px', color: '#fff', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Progress Bar */}
        {loading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)', borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {progress < 40 ? 'Preparando archivo...' : progress < 80 ? 'Importando leads...' : '¡Casi listo!'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              padding: '8px 16px',
              fontWeight: 500,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            style={{
              background: !file || loading ? 'var(--bg-elevated)' : 'var(--accent, #7c3aed)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: !file || loading ? 'var(--text-tertiary)' : '#fff',
              cursor: !file || loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <svg style={{ animation: 'spin 1s linear infinite', width: 13, height: 13 }} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="7" cy="7" r="5" strokeOpacity="0.3" />
                  <path d="M7 2a5 5 0 0 1 5 5" strokeLinecap="round" />
                </svg>
                Importando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 13, height: 13 }}>
                  <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1 12h12" strokeLinecap="round" />
                </svg>
                Importar CSV
              </>
            )}
          </button>
        </div>

      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

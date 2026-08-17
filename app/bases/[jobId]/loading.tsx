export default function LoadingBase() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          height: 80,
          background: 'var(--bg-surface, #141414)',
          borderRadius: 12,
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <div
        style={{
          height: 400,
          background: 'var(--bg-surface, #141414)',
          borderRadius: 12,
          animation: 'shimmer 1.5s infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

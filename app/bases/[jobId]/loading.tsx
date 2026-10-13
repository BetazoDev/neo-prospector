export default function LoadingBase() {
  return (
    <div className="page" style={{ paddingTop: 40, display: 'flex', flexDirection: 'column', gap: 20 }} aria-busy="true">
      <div className="skeleton" style={{ height: 48, width: '40%' }} />
      <div className="skeleton" style={{ height: 160 }} />
      <div className="skeleton" style={{ height: 360 }} />
    </div>
  )
}

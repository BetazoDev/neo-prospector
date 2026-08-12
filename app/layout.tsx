import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NeoProspector — Lead Intelligence Dashboard',
  description:
    'Dashboard de prospección de leads inteligente. Encuentra clientes potenciales en Google Maps con IA, gestiona tus leads y contáctalos por WhatsApp.',
  keywords: 'prospección, leads, Google Maps, WhatsApp, IA, Apify',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="app-layout">{children}</body>
    </html>
  )
}

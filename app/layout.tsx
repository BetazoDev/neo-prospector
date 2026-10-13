import type { Metadata, Viewport } from 'next'
import './globals.css'
import './styles/shell.css'
import './styles/components.css'

export const metadata: Metadata = {
  title: 'Hemeron Prospector',
  description:
    'Prospección de Hemeron: encuentra negocios en Google Maps, revisa sus sitios y detecta a quién le hace falta un rediseño.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0e0e0e',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        {/* Clash Grotesk y Switzer, las tipografías de hemeron.com, desde su distribuidor oficial. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-grotesk@500,600&f[]=switzer@400,500,600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

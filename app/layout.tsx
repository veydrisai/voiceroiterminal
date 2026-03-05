import type { Metadata, Viewport } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'VoiceROI Terminal',
  description: 'VoiceROI Terminal Dashboard',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VoiceROI',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

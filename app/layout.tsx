import type { Metadata, Viewport } from 'next'
import './globals.css'
import InstallPrompt from '@/components/InstallPrompt'
import VersionCheck from '@/components/VersionCheck'

export const metadata: Metadata = {
  title: 'Glanceable',
  description: 'Know what’s happening without asking.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Glanceable',
    description: 'Know what’s happening without asking.',
    images: ['/og.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Glanceable',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F5F3EF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <InstallPrompt />
        <VersionCheck />
      </body>
    </html>
  )
}
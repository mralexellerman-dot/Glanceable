import type { Metadata, Viewport } from 'next'
import './globals.css'
import InstallPrompt from '@/components/InstallPrompt'
import VersionCheck from '@/components/VersionCheck'

export const metadata: Metadata = {
  title: 'Glanceable',
  description: 'A calm status board for shared spaces.',
  manifest: '/manifest.json',
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
    <html lang="en">
      <body>
        {children}
        <InstallPrompt />
        <VersionCheck />
      </body>
    </html>
  )
}

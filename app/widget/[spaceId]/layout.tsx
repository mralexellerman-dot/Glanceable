import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Glanceable',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Glanceable',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children
}

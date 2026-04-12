'use client'

import { useEffect } from 'react'

const APP_VERSION = 'v1.0.3'

export default function VersionCheck() {
  useEffect(() => {
    const stored = localStorage.getItem('app_version')
    if (stored !== APP_VERSION) {
      localStorage.setItem('app_version', APP_VERSION)
      window.location.reload()
    }
  }, [])

  return null
}

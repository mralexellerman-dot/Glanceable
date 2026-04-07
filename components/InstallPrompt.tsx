'use client'

import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [show, setShow]           = useState(false)
  const [showSafari, setShowSafari] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Already installed — running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Safari on iOS doesn't fire beforeinstallprompt — detect it separately
    const isIosSafari =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !('standalone' in navigator && (navigator as any).standalone)
    if (isIosSafari) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
    setShow(false)
    setShowSafari(false)
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') { setShow(false); return }
    }
    // iOS Safari — no native prompt, show manual instructions
    setShowSafari(true)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#1A1A18',
      color: '#FAFAF8',
      borderRadius: '12px',
      padding: '10px 16px',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 9999,
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    }}>
      {showSafari ? (
        <span style={{ whiteSpace: 'normal', maxWidth: '220px', lineHeight: '1.4' }}>
          Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
        </span>
      ) : (
        <button
          onClick={install}
          style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
        >
          Add to Home Screen
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: '#9CA3AF', font: 'inherit', cursor: 'pointer', padding: 0, fontSize: '16px', lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'pwa-prompt-dismissed'

export default function InstallPrompt() {
  const [show, setShow]             = useState(false)
  const [showSafari, setShowSafari] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Already running as an installed PWA — hide everywhere.
    // matchMedia covers Chrome/Android; navigator.standalone covers iOS Safari.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (isStandalone) return

    // User already dismissed — hide for 7 days.
    const dismissedAt = localStorage.getItem(DISMISSED_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return

    // Chrome/Android: capture the native install prompt.
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari: no beforeinstallprompt — show the manual nudge instead.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) setShow(true)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    setShow(false)
    setShowSafari(false)
  }

  async function install() {
    if (deferredPrompt) {
      // Chrome/Android: trigger the native install dialog.
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') { setShow(false); return }
      // Dismissed from native dialog — remember it.
      dismiss()
      return
    }
    // iOS Safari: no native prompt, show one-tap manual instruction.
    setShowSafari(true)
  }

  if (!show) return null

  return (
    <div style={{
      position:  'fixed',
      bottom:    '20px',
      left:      '50%',
      transform: 'translateX(-50%)',
      background: '#1A1A18',
      color:      '#FAFAF8',
      borderRadius: '12px',
      padding:   '10px 16px',
      fontSize:  '13px',
      display:   'flex',
      alignItems: 'center',
      gap:        '12px',
      zIndex:     9999,
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

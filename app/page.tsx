'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const spaceId = localStorage.getItem('dw_space_id')
    if (spaceId) {
      router.replace(`/space/${spaceId}`)
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-[420px] space-y-10">
        <div className="text-center space-y-3">
          <div className="text-5xl">🏠</div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Dwellness
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A calm status board for shared spaces.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/create"
            className="block w-full text-center py-3.5 px-4 rounded-xl text-sm font-medium text-white transition-opacity active:opacity-80"
            style={{ background: '#1A1A18' }}
          >
            Create a space
          </Link>
          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Have an invite link? Open it to join an existing space.
          </p>
        </div>
      </div>
    </main>
  )
}

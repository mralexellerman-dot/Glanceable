'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserId, getUserMemberships } from '@/lib/memberships'

const QUESTIONS = [
  'Did someone get the package?',
  'Is anyone home?',
  'Did someone feed the dog?',
  'Is laundry running?',
  'Did someone start dinner?',
]

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [question] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)])

  useEffect(() => {
    getBrowserId() // ensure browser_id exists in localStorage

    getUserMemberships().then(ms => {
      if (ms.length > 0) {
        // Redirect to most recent space — newest first from query
        router.replace(`/space/${ms[0].space_id}`)
      } else {
        setReady(true)
      }
    })
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
        <div className="text-center space-y-4">
          <p className="text-base font-medium tracking-tight" style={{ color: 'var(--text)' }}>
            {question}
          </p>
          <div>
            <div className="text-4xl mb-2">🏠</div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Dwellness
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              A calm status board for shared spaces.
            </p>
          </div>
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

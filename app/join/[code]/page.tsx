'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Space } from '@/lib/types'

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [space, setSpace] = useState<Space | null>(null)
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // If already a member of this or another space, still allow joining
    async function load() {
      const { data } = await supabase
        .from('spaces')
        .select('*')
        .eq('invite_code', code)
        .single()

      if (data) {
        setSpace(data)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [code])

  async function handleJoin() {
    if (!space || !memberName.trim()) return
    setJoining(true)
    setError('')

    try {
      const { data: member, error: err } = await supabase
        .from('members')
        .insert({ space_id: space.id, display_name: memberName.trim() })
        .select()
        .single()

      if (err) throw err

      localStorage.setItem('dw_space_id', space.id)
      localStorage.setItem('dw_member_id', member.id)
      router.push(`/space/${space.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }

  if (notFound || !space) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-3">
          <p style={{ color: 'var(--text-secondary)' }}>This invite link is invalid or has expired.</p>
          <a href="/" className="text-sm underline" style={{ color: 'var(--text-muted)' }}>
            Go home
          </a>
        </div>
      </main>
    )
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-[420px] space-y-6">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You've been invited to
          </p>
          <h1 className="text-2xl font-semibold mt-1" style={{ color: 'var(--text)' }}>
            🏠 {space.name}
          </h1>
        </div>

        <div className="space-y-3">
          <label className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
            What's your name?
          </label>
          <input
            type="text"
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
            placeholder="Mom, Dad, Sam, Felix…"
            className="w-full px-4 py-3 rounded-xl text-base outline-none"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && memberName.trim() && handleJoin()}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={!memberName.trim() || joining}
            className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
            style={{ background: '#1A1A18' }}
          >
            {joining ? 'Joining…' : 'Join space'}
          </button>
        </div>
      </div>
    </main>
  )
}

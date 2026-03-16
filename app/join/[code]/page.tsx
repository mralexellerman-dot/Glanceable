'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'
import type { Space, Event } from '@/lib/types'

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [space, setSpace] = useState<Space | null>(null)
  const [recentEvents, setRecentEvents] = useState<Event[]>([])
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const browserId = getBrowserId()

      const { data } = await supabase
        .from('spaces')
        .select('*')
        .eq('invite_code', code)
        .single()

      if (!data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Already a member of this space? Go straight in.
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('space_id', data.id)
        .eq('browser_id', browserId)
        .single()

      if (existing) {
        router.replace(`/space/${data.id}`)
        return
      }

      setSpace(data)

      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('space_id', data.id)
        .order('created_at', { ascending: false })
        .limit(3)
      setRecentEvents(events ?? [])
      setLoading(false)
    }
    load()
  }, [code, router])

  async function handleJoin() {
    if (!space || !memberName.trim()) return
    setJoining(true)
    setError('')

    try {
      const browserId = getBrowserId()

      const { error: err } = await supabase
        .from('members')
        .insert({
          space_id: space.id,
          browser_id: browserId,
          display_name: memberName.trim(),
          presence_state: 'home',
          role: 'member',
        })

      if (err) throw err

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
          <a href="/" className="text-sm underline" style={{ color: 'var(--text-muted)' }}>Go home</a>
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
        {/* Living place card */}
        <div
          className="rounded-2xl px-5 py-4 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Join {space.name} on Dwellness
          </h1>
          {recentEvents.length > 0 && (
            <div className="space-y-2">
              {recentEvents.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <span>{e.emoji}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{e.label}</span>
                  <span className="ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {relativeTime(e.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>See what's happening here.</p>
        </div>

        {/* Join form */}
        <div className="space-y-3">
          <label className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
            What's your name in {space.name}?
          </label>
          <input
            type="text"
            value={memberName}
            onChange={e => setMemberName(e.target.value)}
            placeholder="Mom, Dad, Sam, Felix…"
            className="w-full px-4 py-3 rounded-xl text-base outline-none"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
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
            {joining ? 'Joining…' : `Join ${space.name}`}
          </button>
        </div>
      </div>
    </main>
  )
}

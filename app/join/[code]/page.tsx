'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'
import type { Space, Event, Member } from '@/lib/types'

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `just now`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code = (params.code as string).toUpperCase()

  const [space, setSpace] = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
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

      // Fetch members and events to build preview
      const [{ data: membersData }, { data: eventsData }] = await Promise.all([
        supabase
          .from('members')
          .select('*')
          .eq('space_id', data.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*')
          .eq('space_id', data.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      setMembers(membersData ?? [])
      setRecentEvents(eventsData ?? [])
      setLoading(false)
    }
    load()
  }, [code, router])

  async function handleJoin() {
    if (!space || !memberName.trim()) return
    setJoining(true)
    setError('')

    const browserId = getBrowserId()

    // Check for existing membership first (handles duplicate gracefully)
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('space_id', space.id)
      .eq('browser_id', browserId)
      .single()

    if (existing) {
      router.push(`/space/${space.id}`)
      return
    }

    const { error: err } = await supabase
      .from('members')
      .insert({
        space_id: space.id,
        browser_id: browserId,
        display_name: memberName.trim(),
        presence_state: 'tbd',
      })

    if (err) {
      console.error('JOIN ERROR', err)
      setError(err.message)
      setJoining(false)
      return
    }

    router.push(`/space/${space.id}`)
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
            Join {space.name}
          </h1>
          {(() => {
            // Build map of latest activity per member (within 30 min)
            const thirtyMinAgo = Date.now() - 30 * 60_000
            const latestActivityByMemberId = new Map<string, Event>()
            for (const event of recentEvents) {
              if (!event.member_id) continue
              const eventMs = new Date(event.created_at).getTime()
              if (eventMs < thirtyMinAgo) continue
              const existing = latestActivityByMemberId.get(event.member_id)
              if (
                !existing ||
                eventMs > new Date(existing.created_at).getTime()
              ) {
                latestActivityByMemberId.set(event.member_id, event)
              }
            }

            // Show up to 3 members, prefer those with recent activity
            const membersWithActivity = members
              .filter(m => latestActivityByMemberId.has(m.id))
              .slice(0, 3)
            const previewMembers =
              membersWithActivity.length > 0
                ? membersWithActivity
                : members.slice(0, 3)

            if (previewMembers.length === 0) {
              return (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Tap in to see what's happening.
                </p>
              )
            }

            return (
              <div className="space-y-2">
                {previewMembers.map(m => {
                  const activity = latestActivityByMemberId.get(m.id)
                  return (
                    <div key={m.id}>
                      <p style={{ color: 'var(--text)', fontSize: '14px' }}>
                        {m.display_name}
                      </p>
                      {activity && (
                        <p
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '13px',
                            marginTop: '2px',
                          }}
                        >
                          {activity.emoji && <span>{activity.emoji} </span>}
                          <span>{activity.label}</span>
                          <span
                            style={{
                              marginLeft: '6px',
                              color: 'var(--text-muted)',
                            }}
                          >
                            · {relativeTime(activity.created_at)}
                          </span>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tap in to see what's happening.</p>
        </div>

        {/* Join form */}
        <div className="space-y-3">
          <label className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
            Your name in {space.name}
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

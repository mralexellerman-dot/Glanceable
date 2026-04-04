'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'
import { buildRecentActivityMap } from '@/lib/activity'
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
  const [duplicateCandidate, setDuplicateCandidate] = useState<Member | null>(null)

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

    // Name-based duplicate guard (case-insensitive)
    const normalized = memberName.trim().toLowerCase()
    const nameMatch = members.find(m => m.display_name.trim().toLowerCase() === normalized)
    if (nameMatch) {
      setDuplicateCandidate(nameMatch)
      setJoining(false)
      return
    }

    await insertNewMember(space.id, browserId, memberName.trim())
  }

  async function handleRejoin() {
    if (!space || !duplicateCandidate) return
    setJoining(true)
    const browserId = getBrowserId()
    await supabase
      .from('members')
      .update({ browser_id: browserId })
      .eq('id', duplicateCandidate.id)
    router.push(`/space/${space.id}`)
  }

  async function handleJoinAsNew() {
    if (!space) return
    setJoining(true)
    setDuplicateCandidate(null)
    const browserId = getBrowserId()
    await insertNewMember(space.id, browserId, memberName.trim())
  }

  async function insertNewMember(spaceId: string, browserId: string, name: string) {
    const { error: err } = await supabase
      .from('members')
      .insert({
        space_id: spaceId,
        browser_id: browserId,
        display_name: name,
        presence_state: 'tbd',
      })

    if (err) {
      console.error('JOIN ERROR', err)
      setError(err.message)
      setJoining(false)
      return
    }

    router.push(`/space/${space!.id}`)
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
            // Use shared activity map builder (30 min window)
            const latestActivityByMemberId = buildRecentActivityMap(recentEvents)

            // Show up to 2 members, prefer those with recent activity
            const membersWithActivity = members
              .filter(m => latestActivityByMemberId.has(m.id))
              .slice(0, 2)
            const previewMembers =
              membersWithActivity.length > 0
                ? membersWithActivity
                : members.slice(0, 2)

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
                    <div key={m.id} style={{ marginBottom: '8px' }}>
                      <p style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 400 }}>
                        {m.display_name}
                      </p>
                      {activity && (
                        <p
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
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
          {duplicateCandidate ? (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <strong>{duplicateCandidate.display_name}</strong> already exists in this space. Is that you?
              </p>
              <button
                onClick={handleRejoin}
                disabled={joining}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                {joining ? 'Joining…' : `Yes, rejoin as ${duplicateCandidate.display_name}`}
              </button>
              <button
                onClick={handleJoinAsNew}
                disabled={joining}
                className="w-full py-3 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' }}
              >
                No, join as a new member
              </button>
            </div>
          ) : (
            <button
              onClick={handleJoin}
              disabled={!memberName.trim() || joining}
              className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
              style={{ background: '#1A1A18' }}
            >
              {joining ? 'Joining…' : `Join ${space.name}`}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

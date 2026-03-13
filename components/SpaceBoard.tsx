'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Space, Member, Event, Reaction } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESENCE_ICON: Record<string, string> = {
  home: '🏠',
  away: '🌙',
  dnd: '🔕',
  tbd: '❔',
}

const PRESENCE_NEXT: Record<string, string> = {
  home: 'away',
  away: 'dnd',
  dnd: 'tbd',
  tbd: 'home',
}

const QUICK_ACTIONS = [
  { emoji: '🐕', label: 'Dog fed' },
  { emoji: '📦', label: 'Amazon retrieved' },
  { emoji: '🚛', label: 'Trash to curb' },
  { emoji: '🧺', label: 'Laundry running' },
  { emoji: '🍝', label: 'Dinner launch' },
  { emoji: '🔥', label: 'Firepit' },
]

const REACTION_EMOJIS = ['👍', '❤️', '🐾', '😴']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60_000)
  const hr = Math.floor(min / 60)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  if (hr < 24) return `${hr}h`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupReactions(reactions: Reaction[]): { emoji: string; count: number }[] {
  const map: Record<string, number> = {}
  for (const r of reactions) map[r.emoji] = (map[r.emoji] ?? 0) + 1
  return Object.entries(map).map(([emoji, count]) => ({ emoji, count }))
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SpaceBoardProps {
  spaceId: string
  memberId: string
}

export default function SpaceBoard({ spaceId, memberId }: SpaceBoardProps) {
  const router = useRouter()
  const [space, setSpace] = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  // Add event modal
  const [showAdd, setShowAdd] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addEmoji, setAddEmoji] = useState('')

  // Reaction picker
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)

  // Copy invite toast
  const [copied, setCopied] = useState(false)

  const fetchAll = useCallback(async () => {
    const [spaceRes, membersRes, eventsRes] = await Promise.all([
      supabase.from('spaces').select('*').eq('id', spaceId).single(),
      supabase
        .from('members')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at'),
      supabase
        .from('events')
        .select('*, member:members(id, display_name), reactions(*, member:members(id, display_name))')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    if (spaceRes.data) setSpace(spaceRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (eventsRes.data) setEvents(eventsRes.data as Event[])
    setLoading(false)
  }, [spaceId])

  // Initial load + realtime subscription
  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel(`space-${spaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `space_id=eq.${spaceId}` },
        fetchAll
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${spaceId}` },
        fetchAll
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        fetchAll
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [spaceId, fetchAll])

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function logEvent(emoji: string, label: string) {
    // Optimistic
    const optimistic: Event = {
      id: `opt-${Date.now()}`,
      space_id: spaceId,
      member_id: memberId || null,
      emoji,
      label,
      created_at: new Date().toISOString(),
      reactions: [],
    }
    setEvents(prev => [optimistic, ...prev])
    setShowAdd(false)
    setAddLabel('')
    setAddEmoji('')

    await supabase.from('events').insert({
      space_id: spaceId,
      member_id: memberId || null,
      emoji,
      label,
    })
    fetchAll()
  }

  async function cyclePresence(member: Member) {
    const next = PRESENCE_NEXT[member.presence_state]
    setMembers(prev =>
      prev.map(m => m.id === member.id ? { ...m, presence_state: next as Member['presence_state'] } : m)
    )
    await supabase
      .from('members')
      .update({ presence_state: next })
      .eq('id', member.id)
  }

  async function addReaction(eventId: string, emoji: string) {
    setReactionTarget(null)
    await supabase.from('reactions').insert({
      event_id: eventId,
      member_id: memberId || null,
      emoji,
    })
    fetchAll()
  }

  async function copyInviteLink() {
    if (!space) return
    const url = `${window.location.origin}/join/${space.invite_code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function leaveSpace() {
    localStorage.removeItem('dw_space_id')
    localStorage.removeItem('dw_member_id')
    router.push('/')
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const currentEvents = events.filter(e => new Date(e.created_at) >= cutoff)
  const recentEvents = events.filter(e => new Date(e.created_at) < cutoff)
  const homeCount = members.filter(m => m.presence_state === 'home').length
  const awayCount = members.filter(m => m.presence_state === 'away').length

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Space not found.</p>
        <button onClick={leaveSpace} className="text-sm underline" style={{ color: 'var(--text-muted)' }}>
          Go home
        </button>
      </div>
    )
  }

  const noMember = !memberId

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[420px] pb-16">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="px-4 pt-8 pb-5">
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            🏠 {space.name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {homeCount > 0 && `${homeCount} home`}
            {homeCount > 0 && awayCount > 0 && ' · '}
            {awayCount > 0 && `${awayCount} away`}
            {homeCount === 0 && awayCount === 0 && 'everyone away'}
          </p>
        </header>

        <Divider />

        {/* ── Presence ───────────────────────────────────────────────────── */}
        <section className="px-4 py-4">
          <SectionLabel>Presence</SectionLabel>
          <div className="mt-2 space-y-0.5">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => cyclePresence(member)}
                className="flex items-center gap-3 w-full text-left py-2.5 px-1 rounded-lg active:bg-black/[0.03] transition-colors min-h-[44px]"
              >
                <span className="text-lg w-6 text-center leading-none">
                  {PRESENCE_ICON[member.presence_state]}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: 'var(--text)',
                    fontWeight: member.id === memberId ? 600 : 400,
                  }}
                >
                  {member.display_name}
                  {member.id === memberId && (
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      you
                    </span>
                  )}
                </span>
              </button>
            ))}
            {members.length === 0 && (
              <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>No members yet.</p>
            )}
          </div>
        </section>

        <Divider />

        {/* ── Quick Actions ──────────────────────────────────────────────── */}
        <section className="px-4 py-4">
          <SectionLabel>Quick log</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => !noMember && logEvent(action.emoji, action.label)}
                disabled={noMember}
                className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-left transition-colors active:opacity-70 disabled:opacity-40 min-h-[52px]"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <span className="text-base">{action.emoji}</span>
                <span className="leading-tight" style={{ color: 'var(--text-secondary)' }}>
                  {action.label}
                </span>
              </button>
            ))}
            <button
              onClick={() => !noMember && setShowAdd(true)}
              disabled={noMember}
              className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm text-left transition-colors active:opacity-70 disabled:opacity-40 min-h-[52px]"
              style={{
                background: 'transparent',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <span className="text-base">➕</span>
              <span>Add event</span>
            </button>
          </div>
          {noMember && (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <a href={`/join/${space.invite_code}`} className="underline">Join this space</a> to log events.
            </p>
          )}
        </section>

        {/* ── Current Events ─────────────────────────────────────────────── */}
        {currentEvents.length > 0 && (
          <>
            <Divider />
            <section className="px-4 py-4">
              <SectionLabel>Current</SectionLabel>
              <div className="mt-2">
                {currentEvents.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg leading-none">{event.emoji}</span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{event.label}</span>
                    </div>
                    <span className="text-xs ml-3 shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {relativeTime(event.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Recent Events ──────────────────────────────────────────────── */}
        {recentEvents.length > 0 && (
          <>
            <Divider />
            <section className="px-4 py-4">
              <SectionLabel>Recent</SectionLabel>
              <div className="mt-2">
                {recentEvents.map(event => (
                  <div key={event.id} className="py-1">
                    <button
                      className="flex items-center justify-between w-full text-left py-1.5 rounded-lg active:bg-black/[0.03] transition-colors"
                      onClick={() =>
                        setReactionTarget(reactionTarget === event.id ? null : event.id)
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg leading-none">{event.emoji}</span>
                        <span className="text-sm" style={{ color: 'var(--text)' }}>{event.label}</span>
                      </div>
                      <span className="text-xs ml-3 shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {relativeTime(event.created_at)}
                      </span>
                    </button>

                    {/* Reactions display */}
                    {event.reactions && event.reactions.length > 0 && (
                      <div className="flex items-center gap-2 pl-9 mt-0.5">
                        {groupReactions(event.reactions).map(g => (
                          <span key={g.emoji} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {g.emoji}{g.count > 1 ? ` ${g.count}` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Reaction picker */}
                    {reactionTarget === event.id && (
                      <div className="flex items-center gap-3 pl-9 mt-2 mb-1">
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(event.id, emoji)}
                            className="text-xl active:scale-110 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <button
            onClick={copyInviteLink}
            className="text-xs underline transition-colors"
            style={{ color: copied ? '#16a34a' : 'var(--text-muted)' }}
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          <button
            onClick={leaveSpace}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Leave space
          </button>
        </div>

      </div>

      {/* ── Add Event Sheet ──────────────────────────────────────────────── */}
      {showAdd && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.2)' }}
          onClick={() => setShowAdd(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-t-2xl p-6 space-y-4"
            style={{ background: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>Log an event</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={addEmoji}
                onChange={e => setAddEmoji(e.target.value)}
                placeholder="📌"
                className="w-14 px-2 py-3 rounded-xl text-center text-lg outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
                maxLength={2}
              />
              <input
                type="text"
                value={addLabel}
                onChange={e => setAddLabel(e.target.value)}
                placeholder="What happened?"
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                autoFocus
                onKeyDown={e =>
                  e.key === 'Enter' && addLabel.trim() && logEvent(addEmoji || '📌', addLabel.trim())
                }
              />
            </div>
            <button
              onClick={() => addLabel.trim() && logEvent(addEmoji || '📌', addLabel.trim())}
              disabled={!addLabel.trim()}
              className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
              style={{ background: '#1A1A18' }}
            >
              Log event
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Divider() {
  return <div className="mx-4" style={{ borderTop: '1px solid var(--border)' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs uppercase tracking-widest font-medium"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </p>
  )
}

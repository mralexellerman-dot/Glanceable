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

// Quick signals shown at top of Add Event sheet — one-tap log
const SHEET_QUICK = [
  { emoji: '🐶', label: 'Dog fed' },
  { emoji: '📦', label: 'Package inside' },
  { emoji: '🧺', label: 'Laundry running' },
  { emoji: '🍝', label: 'Dinner started' },
  { emoji: '🚛', label: 'Trash to curb' },
]

// Home screen — short curated list
const HOME_PRESETS = [
  { emoji: '🐶', label: 'Dog fed' },
  { emoji: '📦', label: 'Amazon retrieved' },
  { emoji: '🚛', label: 'Trash to curb' },
  { emoji: '🧺', label: 'Laundry running' },
  { emoji: '🍝', label: 'Dinner launch' },
  { emoji: '🔥', label: 'Firepit' },
]

// Signals grouped by category — used in the Signal Picker
const SIGNAL_GROUPS = [
  {
    label: 'Pets',
    signals: [
      { emoji: '🐶', label: 'Dog fed' },
      { emoji: '🐈', label: 'Cat fed' },
      { emoji: '🐈', label: 'Cat spotted' },
    ],
  },
  {
    label: 'Deliveries',
    signals: [
      { emoji: '📦', label: 'Amazon retrieved' },
      { emoji: '🚪', label: 'Package at door' },
      { emoji: '✉️', label: 'Mail retrieved' },
    ],
  },
  {
    label: 'Appliances',
    signals: [
      { emoji: '🧺', label: 'Laundry running' },
      { emoji: '🍽️', label: 'Dishwasher running' },
    ],
  },
  {
    label: 'Atmosphere',
    signals: [
      { emoji: '🍝', label: 'Dinner launch' },
      { emoji: '🔥', label: 'Firepit' },
      { emoji: '🛁', label: 'Hot tub started' },
      { emoji: '🛒', label: 'Groceries in fridge' },
      { emoji: '🎮', label: 'Live streaming' },
      { emoji: '🎧', label: 'Recording podcast' },
      { emoji: '📹', label: 'Stream started' },
    ],
  },
  {
    label: 'House Care',
    signals: [
      { emoji: '🚛', label: 'Trash to curb' },
      { emoji: '🧹', label: 'Cleaning started' },
      { emoji: '🔧', label: 'Maintenance done' },
      { emoji: '🚗', label: 'Car borrowed' },
      { emoji: '💊', label: 'Meds taken' },
    ],
  },
]

// Flat list derived from groups — used for search/matching
const ALL_PRESETS = SIGNAL_GROUPS.flatMap(g => g.signals)

const REACTION_EMOJIS = ['👍', '❤️', '😂', '👀', '🐾', '😴']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diffMs / 1_000)
  const min = Math.floor(diffMs / 60_000)
  const hr = Math.floor(min / 60)
  if (sec < 60) return `${sec}s`
  if (min < 60) return `${min}m`
  if (hr < 24) return `${hr}h`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupReactions(reactions: Reaction[]): { emoji: string; count: number }[] {
  const map: Record<string, number> = {}
  for (const r of reactions) map[r.emoji] = (map[r.emoji] ?? 0) + 1
  return Object.entries(map).map(([emoji, count]) => ({ emoji, count }))
}

// Returns true when two consecutive events are more than 20 min apart
function hasGap(a: Event, b: Event): boolean {
  return Math.abs(
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ) > 20 * 60 * 1000
}

function matchesPreset(query: string, label: string): boolean {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return false
  const l = label.toLowerCase()
  // Substring match OR any word in the label starts with the query
  return l.includes(q) || l.split(' ').some(word => word.startsWith(q))
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

  // Add event sheet
  const [showAdd, setShowAdd] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addEmoji, setAddEmoji] = useState('')
  const [addNote, setAddNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [showSignalPicker, setShowSignalPicker] = useState(false)

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

  useEffect(() => {
    fetchAll()

    const channel = supabase
      .channel(`space-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `space_id=eq.${spaceId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `space_id=eq.${spaceId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, fetchAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [spaceId, fetchAll])

  // ─── Actions ────────────────────────────────────────────────────────────────

  function closeSheet() {
    setShowAdd(false)
    setAddLabel('')
    setAddEmoji('')
    setAddNote('')
    setShowNote(false)
    setShowSignalPicker(false)
  }

  function handleLabelChange(val: string) {
    setAddLabel(val)
    if (val.trim()) {
      const match = ALL_PRESETS.find(p => matchesPreset(val, p.label))
      setAddEmoji(match ? match.emoji : '')
    } else {
      setAddEmoji('')
    }
  }

  function selectSignal(preset: { emoji: string; label: string }) {
    setAddEmoji(preset.emoji)
    setAddLabel(preset.label)
    setShowSignalPicker(false)
  }

  async function logEvent(emoji: string, label: string, note?: string) {
    const optimistic: Event = {
      id: `opt-${Date.now()}`,
      space_id: spaceId,
      member_id: memberId || null,
      emoji,
      label,
      note: note?.trim() || null,
      created_at: new Date().toISOString(),
      reactions: [],
    }
    setEvents(prev => [optimistic, ...prev])
    closeSheet()

    await supabase.from('events').insert({
      space_id: spaceId,
      member_id: memberId || null,
      emoji,
      label,
      ...(note?.trim() ? { note: note.trim() } : {}),
    })
    fetchAll()
  }

  async function cyclePresence(member: Member) {
    const next = PRESENCE_NEXT[member.presence_state]
    setMembers(prev =>
      prev.map(m => m.id === member.id ? { ...m, presence_state: next as Member['presence_state'] } : m)
    )
    await supabase.from('members').update({ presence_state: next }).eq('id', member.id)
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

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000)

  const currentEvents = events.filter(e => new Date(e.created_at) >= cutoff)
  const todayEvents   = events.filter(e => {
    const d = new Date(e.created_at)
    return d >= todayMidnight && d < cutoff
  })
  const earlierEvents = events.filter(e => new Date(e.created_at) < todayMidnight)

  const homeCount = members.filter(m => m.presence_state === 'home').length
  const awayCount = members.filter(m => m.presence_state !== 'home').length
  const hasEvents = currentEvents.length > 0 || todayEvents.length > 0 || earlierEvents.length > 0

  // Up to 3 suggestions shown below the input while typing
  const suggestMatches = (addLabel.trim() && !showSignalPicker)
    ? ALL_PRESETS.filter(p => matchesPreset(addLabel, p.label)).slice(0, 3)
    : []

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
            <span className="text-base mr-1 opacity-60">🏠</span>{space.name}
          </h1>
          <p className="text-xs mt-1 tracking-wide" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            {homeCount} home • {awayCount} away
          </p>
        </header>

        <Divider />

        {/* ── Presence ───────────────────────────────────────────────────── */}
        <section className="px-4 py-3">
          <SectionLabel>Presence</SectionLabel>
          <div className="mt-1.5">
            {members.map(member => (
              <button
                key={member.id}
                onClick={() => cyclePresence(member)}
                className="flex items-center gap-2.5 w-full text-left py-2 px-1 rounded-lg active:bg-black/[0.03] transition-colors min-h-[44px]"
              >
                <span className="text-sm w-5 text-center leading-none opacity-80">
                  {PRESENCE_ICON[member.presence_state]}
                </span>
                <span
                  className="text-sm"
                  style={{ color: 'var(--text)', fontWeight: member.id === memberId ? 500 : 400 }}
                >
                  {member.display_name}
                </span>
                {member.id === memberId && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>you</span>
                )}
              </button>
            ))}
            {members.length === 0 && (
              <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>No members yet.</p>
            )}
          </div>
        </section>

        {/* ── Current Events ─────────────────────────────────────────────── */}
        {currentEvents.length > 0 && (
          <>
            <Divider />
            <section className="px-4 py-5">
              <SectionLabel>Current</SectionLabel>
              <div className="mt-3">
                {currentEvents.map((event, i) => (
                  <div key={event.id}>
                    {i > 0 && hasGap(currentEvents[i - 1], event) && <div className="h-2" />}
                    <EventRow event={event} />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <Divider />

        {/* ── Log ────────────────────────────────────────────────────────── */}
        <section className="px-4 py-3">
          <SectionLabel>Log</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-x-1.5 gap-y-2">
            {HOME_PRESETS.map(action => (
              <button
                key={action.label}
                onClick={() => !noMember && logEvent(action.emoji, action.label)}
                disabled={noMember}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-opacity active:opacity-50 disabled:opacity-30"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{action.emoji}</span>
                <span>{action.label}</span>
              </button>
            ))}
            <button
              onClick={() => !noMember && setShowAdd(true)}
              disabled={noMember}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-opacity active:opacity-50 disabled:opacity-30"
              style={{
                background: 'transparent',
                border: '1px dashed rgba(0,0,0,0.10)',
                color: 'var(--text-muted)',
              }}
            >
              <span>➕</span>
              <span>Add event</span>
            </button>
          </div>
          {noMember && (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <a href={`/join/${space.invite_code}`} className="underline">Join this space</a> to log events.
            </p>
          )}
        </section>

        {/* ── Today ──────────────────────────────────────────────────────── */}
        {todayEvents.length > 0 && (
          <>
            <Divider />
            <section className="px-4 py-4">
              <SectionLabel>Today</SectionLabel>
              <div className="mt-2">
                {todayEvents.map((event, i) => (
                  <HistoryRow
                    key={event.id}
                    event={event}
                    prevEvent={i > 0 ? todayEvents[i - 1] : null}
                    reactionTarget={reactionTarget}
                    onToggleReaction={setReactionTarget}
                    onReact={addReaction}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Earlier ────────────────────────────────────────────────────── */}
        {earlierEvents.length > 0 && (
          <>
            <Divider />
            <section className="px-4 py-4">
              <SectionLabel>Earlier</SectionLabel>
              <div className="mt-2">
                {earlierEvents.map((event, i) => (
                  <HistoryRow
                    key={event.id}
                    event={event}
                    prevEvent={i > 0 ? earlierEvents[i - 1] : null}
                    reactionTarget={reactionTarget}
                    onToggleReaction={setReactionTarget}
                    onReact={addReaction}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {!hasEvents && (
          <>
            <Divider />
            <div className="px-4 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nothing logged yet.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>What happened?</p>
            </div>
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-6 pb-2 flex items-center justify-between">
          <button
            onClick={copyInviteLink}
            className="text-xs underline transition-colors"
            style={{ color: copied ? '#16a34a' : 'var(--text-muted)' }}
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          <button onClick={leaveSpace} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Leave space
          </button>
        </div>

      </div>

      {/* ── Add Event Sheet ──────────────────────────────────────────────── */}
      {showAdd && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.2)' }}
          onClick={closeSheet}
        >
          <div
            className="w-full max-w-[420px] rounded-t-2xl pb-6"
            style={{ background: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Quick signals — one-tap log ───────────────────────────── */}
            <div className="flex flex-wrap gap-1.5 px-5 pt-5 pb-1">
              {SHEET_QUICK.map((s, i) => (
                <button
                  key={i}
                  onClick={() => logEvent(s.emoji, s.label)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs active:opacity-50 transition-opacity"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid rgba(0,0,0,0.07)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            <div className="mx-5 mb-1" style={{ borderTop: '1px solid var(--border)' }} />

            {/* ── Input row: [icon box] [label] ─────────────────────────── */}
            <div className="flex gap-2 px-5 pt-3">
              {/* Icon box — tap to open signal picker */}
              <button
                onClick={() => setShowSignalPicker(v => !v)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-xl shrink-0 transition-colors"
                style={{
                  border: showSignalPicker
                    ? '1px solid rgba(0,0,0,0.22)'
                    : '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: addEmoji ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {addEmoji || '·'}
              </button>

              {/* Label input */}
              <input
                type="text"
                value={addLabel}
                onChange={e => handleLabelChange(e.target.value)}
                placeholder="What happened?"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                autoFocus
                onKeyDown={e =>
                  e.key === 'Enter' && addLabel.trim() &&
                  logEvent(addEmoji || '·', addLabel.trim(), addNote)
                }
              />
            </div>

            {/* ── Signal Picker — grouped by category ───────────────────── */}
            {showSignalPicker && (
              <div className="mt-3 px-5 overflow-y-auto" style={{ maxHeight: '240px' }}>
                {SIGNAL_GROUPS.map(group => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p
                      className="text-xs uppercase tracking-widest mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-0.5">
                      {group.signals.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => selectSignal(p)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left active:bg-black/[0.04] transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <span className="text-base shrink-0">{p.emoji}</span>
                          <span className="truncate">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Suggestions — up to 3 matches shown while typing ─────── */}
            {suggestMatches.length > 0 && (
              <div className="mt-1 mx-5 rounded-xl overflow-hidden" style={{ background: 'var(--bg)' }}>
                {suggestMatches.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => selectSignal(p)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left active:bg-black/[0.04] transition-colors"
                    style={{
                      color: 'var(--text-secondary)',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span className="text-base w-5 text-center leading-none shrink-0">{p.emoji}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Optional note ─────────────────────────────────────────── */}
            <div className="mt-3 px-5">
              {showNote ? (
                <input
                  type="text"
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                  placeholder="Add a note…"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              ) : (
                <button
                  onClick={() => setShowNote(true)}
                  className="text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  + add note
                </button>
              )}
            </div>

            {/* ── Submit ────────────────────────────────────────────────── */}
            <div className="mt-4 px-5">
              <button
                onClick={() => addLabel.trim() && logEvent(addEmoji || '·', addLabel.trim(), addNote)}
                disabled={!addLabel.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                Add event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EventRow — used in Current section ───────────────────────────────────────

function EventRow({ event }: { event: Event }) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-lg w-6 text-center leading-none mt-px shrink-0">{event.emoji}</span>
        <div className="min-w-0">
          <span className="text-sm" style={{ color: 'var(--text)' }}>{event.label}</span>
          {event.note && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{event.note}</p>
          )}
        </div>
      </div>
      <span className="text-xs ml-3 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {relativeTime(event.created_at)}
      </span>
    </div>
  )
}

// ─── HistoryRow — used in Today and Earlier sections ─────────────────────────

interface HistoryRowProps {
  event: Event
  prevEvent: Event | null
  reactionTarget: string | null
  onToggleReaction: (id: string | null) => void
  onReact: (eventId: string, emoji: string) => void
}

function HistoryRow({ event, prevEvent, reactionTarget, onToggleReaction, onReact }: HistoryRowProps) {
  return (
    <div className="py-0.5">
      {prevEvent && hasGap(prevEvent, event) && <div className="h-2" />}
      <button
        className="flex items-start justify-between w-full text-left py-1.5 rounded-lg active:bg-black/[0.03] transition-colors"
        onClick={() => onToggleReaction(reactionTarget === event.id ? null : event.id)}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-base w-5 text-center leading-none mt-0.5 shrink-0">{event.emoji}</span>
          <div className="min-w-0">
            <span className="text-sm" style={{ color: 'var(--text)' }}>{event.label}</span>
            {event.note && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{event.note}</p>
            )}
          </div>
        </div>
        <span className="text-xs ml-3 shrink-0 tabular-nums mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {relativeTime(event.created_at)}
        </span>
      </button>

      {event.reactions && event.reactions.length > 0 && (
        <div className="flex items-center gap-2 pl-8 mt-0.5">
          {groupReactions(event.reactions).map(g => (
            <span key={g.emoji} className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {g.emoji}{g.count > 1 ? ` ${g.count}` : ''}
            </span>
          ))}
        </div>
      )}

      {reactionTarget === event.id && (
        <div className="flex items-center gap-3 pl-8 mt-2 mb-1">
          {REACTION_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(event.id, emoji)}
              className="text-lg active:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
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
    <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Space, Member, Event } from '@/lib/types'
import { getUserMemberships } from '@/lib/memberships'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESENCE_NEXT: Record<string, string> = {
  home: 'away',
  away: 'home',
  dnd:  'home',
  tbd:  'home',
}

// Suggestions shown under "What's happening" — plain text style, no pill borders
// 1 icon in the visible set (text-first per spec v2.3.2)
// First item carries slight visual emphasis
const SUGGESTIONS = [
  { emoji: '',   label: 'Getting coffee' },
  { emoji: '',   label: 'Dinner started' },
  { emoji: '',   label: 'Laundry running' },
  { emoji: '🐶', label: 'Dog fed' },
  { emoji: '',   label: 'Ordering food' },
]

// Sheet quick chips — icon ratio ~40% (2 of 5)
const SHEET_QUICK = [
  { emoji: '',   label: 'Dog fed' },
  { emoji: '',   label: 'Amazon retrieved' },
  { emoji: '🧺', label: 'Laundry running' },
  { emoji: '',   label: 'Dinner started' },
  { emoji: '🔥', label: 'Firepit' },
]

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
      { emoji: '🍝', label: 'Dinner started' },
      { emoji: '🔥', label: 'Firepit' },
      { emoji: '🛁', label: 'Hot tub started' },
      { emoji: '🛒', label: 'Groceries in fridge' },
      { emoji: '🎮', label: 'Live streaming' },
      { emoji: '🎧', label: 'Recording podcast' },
    ],
  },
  {
    label: 'House Care',
    signals: [
      { emoji: '🚛', label: 'Trash to curb' },
      { emoji: '🧹', label: 'Cleaning started' },
      { emoji: '🌱', label: 'Lawn mowed' },
      { emoji: '🔧', label: 'Maintenance done' },
      { emoji: '🚗', label: 'Car borrowed' },
      { emoji: '💊', label: 'Meds taken' },
    ],
  },
]

const ALL_PRESETS = SIGNAL_GROUPS.flatMap(g => g.signals)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const ms  = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(ms / 60_000)
  const hr  = Math.floor(min / 60)
  if (min < 1)  return 'now'
  if (min < 60) return `${min}m`
  if (hr < 24)  return `${hr}h`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function matchesPreset(query: string, label: string): boolean {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return false
  const l = label.toLowerCase()
  return l.includes(q) || l.split(' ').some(w => w.startsWith(q))
}

function generateInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('').toUpperCase()
}

// Bulk: "raked leaves, mowed lawn" → ["Raked leaves", "Mowed lawn"]
function parseBulk(input: string): string[] {
  if (!input.includes(',')) return []
  return input.split(',')
    .map(s => { const t = s.trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : '' })
    .filter(Boolean)
}

// Subtle background warmth by time of day
function timeOfDayBg(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 10) return '#FEFDF9'  // morning: clean
  if (h >= 10 && h < 17) return '#FDFCF8'  // day: neutral warm
  if (h >= 17 && h < 21) return '#FCF9F3'  // evening: warmer
  return '#FBF7EF'                          // night: warmest
}

// Group events by calendar day for Earlier section
function groupByDay(evts: Event[]): { label: string; events: Event[] }[] {
  const map = new Map<string, Event[]>()
  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()
  for (const e of evts) {
    const key = new Date(e.created_at).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries()).map(([key, events]) => {
    let label: string
    if (key === today)     label = 'Today'
    else if (key === yesterday) label = 'Yesterday'
    else label = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label, events }
  })
}

// ─── Ambient summary ──────────────────────────────────────────────────────────
// Format: "[state] · [keyword] + [keyword]"
// Keywords: lowercase, ≤2 words per label, max 2 signals

function keyword(label: string): string {
  const words = label.trim().split(/\s+/)
  // Short labels (≤2 words): use whole thing lowercase
  if (words.length <= 2) return label.toLowerCase()
  // Longer labels: first word only
  return words[0].toLowerCase()
}

function ambientSummary(events: Event[]): string {
  const now  = Date.now()
  const hour = new Date().getHours()

  const inLast = (h: number) =>
    events.filter(e => now - new Date(e.created_at).getTime() < h * 3_600_000)

  // Max 2 distinct keywords from most recent events
  function evidence(pool: Event[]): string {
    return [...new Set(pool.map(e => keyword(e.label)))].slice(0, 2).join(' + ')
  }

  const h2  = inLast(2)
  const h6  = inLast(6)
  const h24 = inLast(24)

  if (h2.length  >= 1) return `Settling down · ${evidence(h2)}`
  if (h6.length  >= 1) return `Active earlier · ${evidence(h6)}`
  if (h24.length >= 1) {
    if (hour < 10)  return `Slow morning · ${evidence(h24)}`
    if (hour >= 20) return `Slow evening · ${evidence(h24)}`
    return `Light activity · ${evidence(h24)}`
  }
  if (hour < 10)  return 'Slow morning'
  if (hour >= 20) return 'Slow evening'
  return 'Quiet now'
}

// ─── Presence opacity ─────────────────────────────────────────────────────────
// 0–45m → 1.0   45–120m → 0.7   2–4h → 0.45   4–8h → 0.25   8h+ → 0.12

function presenceOpacity(m: Member): number {
  const ts     = m.presence_updated_at || m.created_at
  const ageMin = (Date.now() - new Date(ts).getTime()) / 60_000
  if (ageMin < 45)   return 1
  if (ageMin < 120)  return 0.7
  if (ageMin < 240)  return 0.45
  if (ageMin < 480)  return 0.25
  return 0.12
}

function presenceAgeMs(m: Member): number {
  const ts = m.presence_updated_at || m.created_at
  return Date.now() - new Date(ts).getTime()
}

// ─── Query state (localStorage, per space) ────────────────────────────────────

function loadQueriedAt(spaceId: string): number | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(`dw_queried_${spaceId}`)
    return v ? parseInt(v, 10) : null
  } catch { return null }
}

function saveQueriedAt(spaceId: string, ts: number) {
  try { localStorage.setItem(`dw_queried_${spaceId}`, String(ts)) } catch {}
}

function clearQueriedAt(spaceId: string) {
  try { localStorage.removeItem(`dw_queried_${spaceId}`) } catch {}
}

// Returns display string for the query tag, or null if expired / not set
function queryTag(queriedAt: number | null): string | null {
  if (!queriedAt) return null
  const minAgo = Math.floor((Date.now() - queriedAt) / 60_000)
  if (minAgo >= 60) return null
  if (minAgo < 1)   return 'just now'
  return `${minAgo}m ago`
}

// Opacity for the query tag — fades between 15 and 60 min
function queryTagOpacity(queriedAt: number | null): number {
  if (!queriedAt) return 0
  const minAgo = (Date.now() - queriedAt) / 60_000
  if (minAgo < 15)  return 1
  if (minAgo >= 60) return 0
  return 1 - (minAgo - 15) / 45
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SpaceBoardProps {
  spaceId: string
  memberId: string
}

export default function SpaceBoard({ spaceId, memberId }: SpaceBoardProps) {
  const router = useRouter()

  const [activeMemberId] = useState(memberId)

  const [space,   setSpace]   = useState<Space | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [events,  setEvents]  = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  // Add event sheet
  const [showAdd,          setShowAdd]          = useState(false)
  const [addLabel,         setAddLabel]         = useState('')
  const [addEmoji,         setAddEmoji]         = useState('')
  const [addNote,          setAddNote]          = useState('')
  const [showNote,         setShowNote]         = useState(false)
  const [showSignalPicker, setShowSignalPicker] = useState(false)

  // UI state
  const [copied,      setCopied]      = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [newName,     setNewName]     = useState('')
  const [logExpanded, setLogExpanded] = useState(false)
  const [otherSpaces, setOtherSpaces] = useState<{ id: string; name: string }[]>([])

  // Name tap — "finger" tooltip
  const [tappedMemberId, setTappedMemberId] = useState<string | null>(null)
  const presenceRef = useRef<HTMLDivElement>(null)

  // Query state — when "What's happening" was last tapped
  const [queriedAt, setQueriedAt] = useState<number | null>(null)
  // Tick every 30s to update elapsed display
  const [tick, setTick] = useState(0)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    const [spaceRes, membersRes, eventsRes] = await Promise.all([
      supabase.from('spaces').select('*').eq('id', spaceId).single(),
      supabase.from('members').select('*').eq('space_id', spaceId).order('created_at'),
      supabase
        .from('events')
        .select('*, member:members(id, display_name)')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(80),
    ])
    if (spaceRes.data)   setSpace(spaceRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (eventsRes.data)  setEvents(eventsRes.data as Event[])
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel(`space-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `space_id=eq.${spaceId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events',  filter: `space_id=eq.${spaceId}` }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [spaceId, fetchAll])

  useEffect(() => {
    getUserMemberships().then(ms => {
      const others = ms.filter(m => m.space_id !== spaceId)
      if (others.length > 0) setOtherSpaces(others.map(m => ({ id: m.space_id, name: m.space.name })))
    })
  }, [spaceId])

  // Load query state from localStorage on mount
  useEffect(() => {
    const saved = loadQueriedAt(spaceId)
    if (saved) {
      const minAgo = (Date.now() - saved) / 60_000
      if (minAgo < 60) setQueriedAt(saved)
      else clearQueriedAt(spaceId)
    }
  }, [spaceId])

  // Tick every 30s so query elapsed time updates
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Dismiss name tap on outside click
  useEffect(() => {
    if (!tappedMemberId) return
    function handleOutside(e: MouseEvent) {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setTappedMemberId(null)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [tappedMemberId])

  // ─── Actions ────────────────────────────────────────────────────────────────

  function closeSheet() {
    setShowAdd(false); setAddLabel(''); setAddEmoji('')
    setAddNote(''); setShowNote(false); setShowSignalPicker(false)
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

  function handleWhatHappening() {
    const ts = Date.now()
    setQueriedAt(ts)
    saveQueriedAt(spaceId, ts)
    setLogExpanded(true)
  }

  async function logEvent(emoji: string, label: string, note?: string) {
    const bulk = parseBulk(label)
    const mid  = activeMemberId ?? null
    const now  = Date.now()

    if (bulk.length >= 2) {
      // Bulk: insert each item with slight timestamp offset so order is preserved
      const optimistic = bulk.map((lbl, i) => ({
        id: `opt-${now}-${i}`, space_id: spaceId, member_id: mid,
        emoji: '', label: lbl, note: null,
        created_at: new Date(now - i * 500).toISOString(),
      }))
      setEvents(prev => [...optimistic, ...prev])
      closeSheet(); setLogExpanded(false); setQueriedAt(null); clearQueriedAt(spaceId)
      await Promise.all(bulk.map(lbl =>
        supabase.from('events').insert({ space_id: spaceId, member_id: mid, emoji: '', label: lbl })
      ))
    } else {
      setEvents(prev => [{
        id: `opt-${now}`, space_id: spaceId, member_id: mid,
        emoji, label, note: note?.trim() || null, created_at: new Date(now).toISOString(),
      }, ...prev])
      closeSheet(); setLogExpanded(false); setQueriedAt(null); clearQueriedAt(spaceId)
      await supabase.from('events').insert({
        space_id: spaceId, member_id: mid, emoji, label,
        ...(note?.trim() ? { note: note.trim() } : {}),
      })
    }
    fetchAll()
  }

  async function cyclePresence(member: Member) {
    const next = PRESENCE_NEXT[member.presence_state]
    const now  = new Date().toISOString()
    setMembers(prev => prev.map(m =>
      m.id === member.id ? { ...m, presence_state: next as Member['presence_state'], presence_updated_at: now } : m
    ))
    await supabase.from('members').update({ presence_state: next, presence_updated_at: now }).eq('id', member.id)
  }

  async function copyInviteLink() {
    if (!space) return
    await navigator.clipboard.writeText(`${window.location.origin}/join/${space.invite_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateInvite() {
    if (!space) return
    await supabase.from('spaces').update({ invite_code: generateInviteCode() }).eq('id', space.id)
    fetchAll()
  }

  async function saveName() {
    setEditingName(false)
    if (!space || !newName.trim() || newName.trim() === space.name) return
    await supabase.from('spaces').update({ name: newName.trim() }).eq('id', space.id)
    fetchAll()
  }

  async function leaveSpace() {
    if (activeMemberId) await supabase.from('members').delete().eq('id', activeMemberId)
    router.push('/')
  }

  async function deleteEvent(eventId: string) {
    setEvents(prev => prev.filter(e => e.id !== eventId))
    await supabase.from('events').delete().eq('id', eventId)
    fetchAll()
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  // Suppress unused tick warning — it's only there to force re-render for query elapsed time
  void tick

  const cutoff12h     = new Date(Date.now() - 12 * 3_600_000)
  const todayEvents   = events.filter(e => new Date(e.created_at) >= cutoff12h)
  const earlierEvents = events.filter(e => new Date(e.created_at) < cutoff12h)
  const earlierGroups = groupByDay(earlierEvents)

  // All members, sorted most recently active first
  const sortedMembers = [...members].sort((a, b) => presenceAgeMs(a) - presenceAgeMs(b))

  const summary = ambientSummary(events)
  const isOwner = members.find(m => m.id === activeMemberId)?.role === 'owner'

  const qTag     = queryTag(queriedAt)
  const qOpacity = queryTagOpacity(queriedAt)

  const isSearching   = searchQuery.trim().length > 0
  const searchResults = isSearching
    ? events.filter(e => {
        const q = searchQuery.toLowerCase()
        return e.label.toLowerCase().includes(q) || (e.note?.toLowerCase().includes(q) ?? false)
      })
    : []

  const suggestMatches = addLabel.trim() && !showSignalPicker
    ? ALL_PRESETS.filter(p => matchesPreset(addLabel, p.label)).slice(0, 3)
    : []

  const bulkItems = parseBulk(addLabel)
  const isBulk    = bulkItems.length >= 2

  // Last event per member (for name tap tooltip)
  function lastEventFor(mid: string): Event | null {
    return events.find(e => e.member_id === mid) ?? null
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <span className="text-sm" style={{ color: '#CCC' }}>Loading…</span>
    </div>
  )

  if (!space) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6" style={{ background: 'var(--bg)' }}>
      <p className="text-sm" style={{ color: '#888' }}>Space not found.</p>
      <button onClick={leaveSpace} className="text-xs underline" style={{ color: '#BBB' }}>Go home</button>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto w-full max-w-[480px] pb-24 min-h-screen" style={{ background: timeOfDayBg() }}>

        {/* ── 1. HEADER ─────────────────────────────────────────────────────── */}
        <header className="px-5 pt-9 pb-4">
          {editingName ? (
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              className="text-[22px] font-semibold tracking-tight w-full bg-transparent outline-none"
              style={{ color: '#1C1814', borderBottom: '1px solid #EDE9E3' }}
              autoFocus
            />
          ) : (
            <h1
              className="text-[22px] font-semibold tracking-tight leading-snug"
              style={{ color: '#1C1814', cursor: isOwner ? 'text' : 'default' }}
              onClick={() => { if (isOwner) { setNewName(space.name); setEditingName(true) } }}
            >
              <span className="mr-1.5 opacity-40 text-xl">🏠</span>{space.name}
            </h1>
          )}
          <p className="mt-1 text-[13px]" style={{ color: '#8A8680', fontStyle: 'italic', fontWeight: 300 }}>
            {summary}
          </p>
        </header>

        {/* ── 2. PRESENCE ROW ───────────────────────────────────────────────── */}
        {sortedMembers.length > 0 && (
          <section ref={presenceRef} className="px-5 pb-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              {sortedMembers.map(m => {
                const isMe       = m.id === activeMemberId
                const opacity    = presenceOpacity(m)
                const isTapped   = tappedMemberId === m.id
                const lastEvent  = isTapped ? lastEventFor(m.id) : null

                return (
                  <div key={m.id} className="relative">
                    <button
                      onClick={() => setTappedMemberId(isTapped ? null : m.id)}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        padding:      '3px 10px',
                        borderRadius: '999px',
                        background:   isTapped ? '#E8E0D4' : '#F0EAE0',
                        fontSize:     '13px',
                        color:        '#2A2620',
                        opacity,
                        border:       'none',
                        lineHeight:   '1.5',
                        cursor:       'pointer',
                        fontWeight:   isMe ? 500 : 400,
                      }}
                    >
                      {m.display_name}
                    </button>

                    {/* Name tap tooltip */}
                    {isTapped && (
                      <div
                        className="absolute left-0 z-10 mt-1 rounded-lg px-3 py-2 whitespace-nowrap"
                        style={{ background: '#F5F2EE', border: '1px solid #EDE8E2', top: '100%' }}
                      >
                        {lastEvent ? (
                          <p className="text-xs" style={{ color: '#6E6A64' }}>
                            <span style={{ color: '#A8A49C', fontWeight: 400 }}>Last recorded</span>
                            <br />
                            {lastEvent.emoji && `${lastEvent.emoji} `}{lastEvent.label}
                            <span style={{ color: '#B8B4AC' }}> · {relativeTime(lastEvent.created_at)}</span>
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: '#B8B4AC' }}>No events yet</p>
                        )}
                        {isMe && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cyclePresence(m); setTappedMemberId(null) }}
                            className="mt-1.5 text-xs block"
                            style={{ color: '#A8A49C' }}
                          >
                            {m.presence_state === 'home' ? 'Mark away' : 'Mark home'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <Rule />

        {/* ── Search Results (replaces Today/Earlier when active) ────────────── */}
        {isSearching && (
          <section className="px-5 py-3">
            <Label>Results</Label>
            {searchResults.length > 0 ? (
              <div className="mt-2">
                {searchResults.map(e => (
                  <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm" style={{ color: '#C4C0B8' }}>No results.</p>
            )}
          </section>
        )}

        {/* ── 4 + 5. TODAY with "What's happening" and events ───────────────── */}
        {!isSearching && (
          <section className="px-5 py-4">
            <Label>Today</Label>

            {/* What's happening — query trigger, scrolls with content */}
            <div className="mt-2 mb-3">
              {!logExpanded ? (
                /* Collapsed: ambient text trigger */
                <p
                  onClick={handleWhatHappening}
                  style={{ fontSize: '14px', color: '#B4B0A8', cursor: 'pointer', userSelect: 'none' }}
                >
                  What's happening
                  {qTag && (
                    <span style={{ opacity: qOpacity, color: '#C4C0B8' }}> · {qTag}</span>
                  )}
                </p>
              ) : (
                /* Expanded: text-style suggestions — no pill borders, plain ambient weight */
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: '14px', color: '#B4B0A8' }}>
                      What's happening
                      {qTag && (
                        <span style={{ opacity: qOpacity, color: '#C4C0B8' }}> · {qTag}</span>
                      )}
                    </p>
                    <button onClick={() => setLogExpanded(false)} style={{ color: '#D0CCCA', fontSize: '13px', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div className="flex flex-col gap-0">
                    {SUGGESTIONS.map((a, i) => (
                      <button
                        key={a.label}
                        onClick={() => logEvent(a.emoji, a.label)}
                        style={{
                          display:    'block',
                          width:      '100%',
                          textAlign:  'left',
                          padding:    '5px 0',
                          fontSize:   '14px',
                          color:      i === 0 ? '#8C887E' : '#ACA8A0',
                          fontWeight: i === 0 ? 450 : 400,
                          border:     'none',
                          background: 'transparent',
                          cursor:     'pointer',
                        }}
                      >
                        {a.emoji ? `${a.emoji} ${a.label}` : a.label}
                      </button>
                    ))}
                    <button
                      onClick={() => { setShowAdd(true); setLogExpanded(false) }}
                      style={{ display: 'block', textAlign: 'left', padding: '5px 0', fontSize: '13px', color: '#C4C0B8', border: 'none', background: 'transparent', cursor: 'pointer' }}
                    >
                      + more
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Today events */}
            {todayEvents.map((e, i) => (
              <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} isFirst={i === 0} />
            ))}
          </section>
        )}

        {/* ── 6. EARLIER ────────────────────────────────────────────────────── */}
        {!isSearching && earlierEvents.length > 0 && (
          <>
            <Rule />
            <section className="px-5 py-4">
              <Label>Earlier</Label>
              <div className="mt-2">
                {earlierGroups.map((group, gi) => (
                  <div key={group.label}>
                    {earlierGroups.length > 1 && (
                      <p
                        className="text-xs"
                        style={{ color: '#C4C0B8', marginTop: gi === 0 ? '0' : '12px', marginBottom: '2px' }}
                      >
                        {group.label}
                      </p>
                    )}
                    {group.events.map(e => (
                      <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <Rule />

        {/* ── 7. SEARCH ─────────────────────────────────────────────────────── */}
        <section className="px-5 py-3">
          <div className="flex items-center gap-2">
            <span style={{ color: '#CEC9C3', fontSize: '13px' }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search this place…"
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: '13px', color: '#4A453F', caretColor: '#A8A49C' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ color: '#C4C0B8', fontSize: '12px', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
            )}
          </div>
        </section>

        <Rule />

        {/* ── FOOTER ────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={copyInviteLink}
              className="text-xs underline"
              style={{ color: copied ? '#4A9' : '#C4C0B8' }}
            >
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
            {isOwner && (
              <button onClick={regenerateInvite} className="text-xs" style={{ color: '#D0CCCA', border: 'none', background: 'none', cursor: 'pointer' }}>
                Reset link
              </button>
            )}
            <button onClick={leaveSpace} className="text-xs ml-auto" style={{ color: '#D0CCCA', border: 'none', background: 'none', cursor: 'pointer' }}>
              Leave space
            </button>
          </div>
          {otherSpaces.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #EDE9E3' }}>
              {otherSpaces.map(s => (
                <a key={s.id} href={`/space/${s.id}`} className="block text-xs py-0.5" style={{ color: '#C4C0B8' }}>
                  🏠 {s.name}
                </a>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── ADD EVENT SHEET ───────────────────────────────────────────────── */}
      {showAdd && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.15)' }}
          onClick={closeSheet}
        >
          <div
            className="w-full max-w-[480px] rounded-t-2xl pb-8"
            style={{ background: '#FFFFFF' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Quick signals */}
            <div className="flex flex-wrap gap-1.5 px-5 pt-5 pb-2">
              {SHEET_QUICK.map(s => (
                <button
                  key={s.label}
                  onClick={() => logEvent(s.emoji, s.label)}
                  style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          '6px',
                    padding:      '5px 12px',
                    borderRadius: '999px',
                    background:   '#F4F1EC',
                    fontSize:     '13px',
                    color:        '#3A3630',
                    border:       'none',
                    cursor:       'pointer',
                  }}
                >
                  {s.emoji && `${s.emoji} `}{s.label}
                </button>
              ))}
            </div>

            {/* Custom label */}
            <div className="px-5 pt-2">
              <div className="flex items-center gap-2 pb-2.5" style={{ borderBottom: '1px solid #EDE9E3' }}>
                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0, opacity: addEmoji ? 1 : 0.2 }}>
                  {addEmoji || '·'}
                </span>
                <input
                  type="text"
                  value={addLabel}
                  onChange={e => handleLabelChange(e.target.value)}
                  placeholder="What happened?"
                  className="flex-1 text-sm bg-transparent outline-none"
                  style={{ color: '#2C2924' }}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && addLabel.trim()) logEvent(addEmoji, addLabel.trim(), addNote)
                  }}
                />
                {/* Subtle char counter — visible at 20+, warning tone at 30+ */}
                {addLabel.length >= 20 && (
                  <span style={{
                    fontSize: '11px',
                    color: addLabel.length >= 30 ? '#D4956A' : '#C4C0B8',
                    flexShrink: 0,
                    tabularNums: true,
                  } as React.CSSProperties}>
                    {addLabel.length}
                  </span>
                )}
                <button
                  onClick={() => setShowSignalPicker(v => !v)}
                  style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: '#F4F1EC', color: '#A8A49C', border: 'none', cursor: 'pointer' }}
                >
                  Browse
                </button>
              </div>

              {/* Bulk preview */}
              {isBulk && (
                <div className="mt-2 space-y-0.5">
                  {bulkItems.map((item, i) => (
                    <p key={i} className="text-sm" style={{ color: '#4A453F' }}>{item}</p>
                  ))}
                </div>
              )}

              {/* Type-ahead */}
              {!isBulk && suggestMatches.length > 0 && (
                <div className="flex gap-1.5 pt-2">
                  {suggestMatches.map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setAddEmoji(p.emoji); setAddLabel(p.label); setShowSignalPicker(false) }}
                      style={{ padding: '2px 8px', borderRadius: '999px', background: '#F4F1EC', fontSize: '12px', color: '#4A453F', border: 'none', cursor: 'pointer' }}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Signal picker */}
              {showSignalPicker && (
                <div className="mt-3 space-y-3 max-h-52 overflow-y-auto">
                  {SIGNAL_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-xs mb-1.5" style={{ color: '#C4C0B8' }}>{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.signals.map(s => (
                          <button
                            key={s.label}
                            onClick={() => { setAddEmoji(s.emoji); setAddLabel(s.label); setShowSignalPicker(false) }}
                            style={{ padding: '2px 8px', borderRadius: '999px', background: '#F4F1EC', fontSize: '12px', color: '#3A3630', border: 'none', cursor: 'pointer' }}
                          >
                            {s.emoji} {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addLabel.trim() && !showNote && (
                <button onClick={() => setShowNote(true)} style={{ marginTop: '8px', fontSize: '12px', color: '#C4C0B8', border: 'none', background: 'none', cursor: 'pointer' }}>
                  + Add note
                </button>
              )}
              {showNote && (
                <input
                  type="text"
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                  placeholder="Optional note…"
                  className="mt-2 w-full text-xs bg-transparent outline-none"
                  style={{ color: '#888' }}
                  autoFocus
                />
              )}
            </div>

            <div className="px-5 mt-5">
              <button
                onClick={() => {
                  if (!addLabel.trim()) return
                  logEvent(addEmoji, addLabel.trim(), addNote)
                }}
                disabled={!addLabel.trim()}
                className="w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-25"
                style={{ background: '#1A1A18' }}
              >
                {isBulk ? `Add ${bulkItems.length} events` : 'Add event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface EventRowProps {
  event: Event
  activeMemberId: string
  onDelete: (id: string) => void
  isFirst?: boolean
}

function EventRow({ event, activeMemberId, onDelete, isFirst }: EventRowProps) {
  const canDelete = !!activeMemberId
    && event.member_id === activeMemberId
    && Date.now() - new Date(event.created_at).getTime() < 10 * 60_000

  return (
    <div className="flex items-baseline justify-between" style={{ paddingTop: '5px', paddingBottom: '5px' }}>
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        {event.emoji && (
          <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>{event.emoji}</span>
        )}
        <div className="min-w-0">
          <span className="text-sm leading-snug" style={{ color: '#16140C', fontWeight: isFirst ? 500 : 400 }}>{event.label}</span>
          {event.note && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#B8B4AC' }}>{event.note}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-4 shrink-0">
        <span className="text-xs tabular-nums" style={{ color: '#CCC6BC' }}>
          {relativeTime(event.created_at)}
        </span>
        {canDelete && (
          <button
            onClick={() => onDelete(event.id)}
            style={{ color: '#D0CCCA', fontSize: '14px', lineHeight: 1, border: 'none', background: 'none', cursor: 'pointer' }}
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Rule() {
  return <div style={{ borderTop: '1px solid #EDE9E3', margin: '0 20px' }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C4C0B8', fontWeight: 500 }}>
      {children}
    </p>
  )
}

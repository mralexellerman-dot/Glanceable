'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Space, Member, Event, Upcoming } from '@/lib/types'
import { getUserMemberships } from '@/lib/memberships'
import { buildSuggestions } from '@/lib/suggestions'
import type { SuggestionItem } from '@/lib/suggestions'
import { getWeatherCondition } from '@/lib/weather'
import type { WeatherCondition } from '@/lib/weather'
import { onNetworkChange } from '@/lib/network'
import type { NetworkType } from '@/lib/network'
import { buildRecentActivityMap } from '@/lib/activity'

// ─── Constants ────────────────────────────────────────────────────────────────

// Sheet quick chips — social/identity first, no chores
const SHEET_QUICK = [
  { emoji: '🍝', label: 'Dinner started' },
  { emoji: '🔥', label: 'Firepit' },
  { emoji: '🐶', label: 'Dog fed' },
  { emoji: '🧺', label: 'Laundry running' },
  { emoji: '',   label: 'Cooking' },
]

const SIGNAL_GROUPS = [
  {
    label: 'Meals',
    signals: [
      { emoji: '🍝', label: 'Dinner started' },
      { emoji: '',   label: 'Cooking' },
      { emoji: '',   label: 'Ordering food' },
      { emoji: '🛒', label: 'Groceries in fridge' },
    ],
  },
  {
    label: 'Pets',
    signals: [
      { emoji: '🐶', label: 'Dog fed' },
      { emoji: '🐈', label: 'Cat fed' },
      { emoji: '🐈', label: 'Cat spotted' },
    ],
  },
  {
    label: 'Moments',
    signals: [
      { emoji: '🔥', label: 'Firepit' },
      { emoji: '🛁', label: 'Hot tub started' },
      { emoji: '🎮', label: 'Live streaming' },
      { emoji: '🎧', label: 'Recording podcast' },
    ],
  },
  {
    label: 'Home',
    signals: [
      { emoji: '🧺', label: 'Laundry running' },
      { emoji: '📦', label: 'Package at door' },
      { emoji: '✉️', label: 'Mail retrieved' },
    ],
  },
]

const ALL_PRESETS = SIGNAL_GROUPS.flatMap(g => g.signals)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string, now: number = Date.now()): string {
  const then = new Date(dateStr).getTime()
  const min  = Math.floor((now - then) / 60_000)
  const hr   = Math.floor(min / 60)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m`
  if (hr  < 5)  return `${hr}h`
  const todayDs = new Date(now).toDateString()
  const thenDs  = new Date(then).toDateString()
  if (thenDs === todayDs)                           return 'earlier today'
  if (thenDs === new Date(now - 86_400_000).toDateString()) return 'yesterday'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function countdownTime(dateStr: string, now: number = Date.now()): string {
  const min = Math.round((new Date(dateStr).getTime() - now) / 60_000)
  if (min <= 0)  return 'now'
  if (min === 1) return '1m'
  if (min < 60)  return `${min}m`
  if (min < 120) return `1h`
  return `${Math.floor(min / 60)}h`
}

function formatCountdown(dateStr: string, now: number = Date.now()): string {
  const ct = countdownTime(dateStr, now)
  return ct === 'now' ? 'now' : `in ${ct}`
}

function clockTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatExactTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Parse natural-language scheduling phrases.
// Returns { label, starts_at } if matched, null otherwise.
function parseScheduled(text: string): { label: string; starts_at: string } | null {
  // "dinner in 20" / "dinner in 20m" / "dinner in 20 min" / "dinner in 2h" / "dinner in 1 hour"
  const rel = text.match(/^(.+?)\s+in\s+(\d+)\s*(m(?:in(?:ute)?s?)?|h(?:r?s?|ours?)?)$/i)
  if (rel) {
    const raw  = rel[1].trim()
    const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    const n     = parseInt(rel[2])
    const unitStr = (rel[3] || 'm').toLowerCase()
    // Normalize unit: recognize min/minute/minutes/m as minutes, h/hr/hour/hours as hours
    const isHours = /^h/.test(unitStr) // starts with 'h'
    const ms    = isHours ? n * 3_600_000 : n * 60_000
    if (n > 0 && ms <= 24 * 3_600_000) {
      return { label, starts_at: new Date(Date.now() + ms).toISOString() }
    }
  }
  // "movie at 8" / "pickup at 3:15"
  const at = text.match(/^(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?$/i)
  if (at) {
    const raw  = at[1].trim()
    const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    const h     = parseInt(at[2])
    const m     = parseInt(at[3] ?? '0')
    if (h >= 1 && h <= 12 && m >= 0 && m < 60) {
      const now   = new Date()
      const nowMs = now.getTime()
      // Try candidates in order: h (AM/noon), h+12 (PM/midnight)
      for (const ch of h === 12 ? [12, 0] : [h, h + 12]) {
        const d = new Date(now)
        d.setHours(ch, m, 0, 0)
        if (d.getTime() > nowMs) return { label, starts_at: d.toISOString() }
      }
      // Both past — wrap to tomorrow AM
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      d.setHours(h, m, 0, 0)
      return { label, starts_at: d.toISOString() }
    }
  }
  return null
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

// Presence chips — Home and Away only
function buildPresenceChips(): { label: string; state: string }[] {
  return [
    { label: 'Here', state: 'home' },
    { label: 'Away', state: 'away' },
  ]
}

const RECENT_TAP_MS = 45 * 60_000

// Activity chips for Quick Log — time-aware, recently-tapped items sink to the end
function buildActivityChips(
  spaceName: string,
  hour: number,
  recentTaps: Map<string, number> = new Map(),
): { emoji: string; label: string }[] {
  const isTeam = /team|practice|league|gym|court|dance|volleyball|soccer|hockey|yoga/.test(spaceName.toLowerCase())

  let chips: { emoji: string; label: string }[]
  if (isTeam) {
    chips = [
      { emoji: '', label: 'Warmup' },
      { emoji: '', label: 'Drills' },
      { emoji: '', label: 'Scrimmage' },
      { emoji: '', label: 'Wrapping up' },
    ]
  } else if (hour >= 5 && hour < 11) {
    chips = [
      { emoji: '☕', label: 'Coffee' },
      { emoji: '',   label: 'Breakfast' },
      { emoji: '',   label: 'Leaving' },
      { emoji: '',   label: 'Working' },
      { emoji: '',   label: 'School' },
    ]
  } else if (hour >= 11 && hour < 16) {
    chips = [
      { emoji: '',   label: 'Lunch' },
      { emoji: '',   label: 'Working' },
      { emoji: '',   label: 'Errands' },
      { emoji: '',   label: 'Out' },
    ]
  } else if (hour >= 16 && hour < 21) {
    chips = [
      { emoji: '🍝', label: 'Dinner started' },
      { emoji: '',   label: 'Cooking' },
      { emoji: '',   label: 'Relaxing' },
      { emoji: '',   label: 'Home' },
    ]
  } else if (hour >= 21 || hour < 2) {
    chips = [
      { emoji: '',   label: 'Relaxing' },
      { emoji: '',   label: 'Watching' },
      { emoji: '',   label: 'Sleep soon' },
    ]
  } else {
    chips = [
      { emoji: '',   label: 'Relaxing' },
      { emoji: '',   label: 'Awake' },
    ]
  }

  const now = Date.now()
  const isRecent = (label: string) => {
    const t = recentTaps.get(label)
    return t !== undefined && now - t < RECENT_TAP_MS
  }
  return [
    ...chips.filter(c => !isRecent(c.label)),
    ...chips.filter(c =>  isRecent(c.label)),
  ]
}

// Subtle background warmth by time of day
function timeOfDayBg(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 11) return 'bg-stone-50'
  if (h >= 11 && h < 16) return 'bg-stone-100'
  if (h >= 16 && h < 21) return 'bg-amber-50'
  return 'bg-stone-100'
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

// ─── Ambient summary v2 ───────────────────────────────────────────────────────
// Priority: recent activity > presence > composite(presence·upcoming) > weather > quiet
// Composites ([context] · [upcoming]) are allowed when activity is weak + upcoming is near.
// Max 2 parts; never combines weather, never restates visible events.

function weatherPhrase(weather: WeatherCondition, hour: number): string | null {
  if (!weather) return null
  const tod = hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'
  const adj = weather === 'rain'  ? 'Rainy'
            : weather === 'storm' ? 'Stormy'
            : weather === 'snow'  ? 'Snowy'
            : 'Hot'
  return `${adj} ${tod}`
}

function ambientSummary(
  events:    Event[],
  members:   Member[],
  upcoming:  Upcoming[],
  spaceName: string          = '',
  weather:   WeatherCondition = null,
): string {
  const now  = Date.now()
  const hour = new Date().getHours()
  const n    = spaceName.toLowerCase()
  const isTeam = /team|practice|league|gym|court|dance|volleyball|soccer|hockey|yoga/.test(n)

  const inLast = (ms: number) =>
    events.filter(e => now - new Date(e.created_at).getTime() < ms)

  const hot  = inLast(30 * 60_000)
  const warm = inLast(60 * 60_000)
  const h4   = inLast(4  * 3_600_000)
  const h24  = inLast(24 * 3_600_000)

  // Presence — members active within 10h
  const visibleM = members.filter(m => presenceAgeHours(m) < 10)
  const homeN    = visibleM.filter(m => m.presence_state === 'home').length
  const awayN    = visibleM.length - homeN
  const totalM   = visibleM.length

  // Presence context phrase — null when not meaningful enough for a composite
  function ctx(): string | null {
    if (totalM < 2) return null
    if (isTeam)     return awayN === 0 ? 'Team gathering' : null
    if (awayN === 0) return 'Everyone home'
    if (homeN === 0) return 'Everyone out'
    return 'House split'
  }

  // Upcoming within 2h
  const soon = upcoming.find(u => {
    const mins = (new Date(u.starts_at).getTime() - now) / 60_000
    return mins > 0 && mins <= 120
  })

  // Upcoming label — capitalised standalone, or lowercase after ·
  function upLabel(lower = false): string {
    if (!soon) return ''
    const mins = (new Date(soon.starts_at).getTime() - now) / 60_000
    const raw  = soon.label.trim().split(/\s+/)[0]
    const word = lower ? raw.toLowerCase()
                       : raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    return mins <= 30 ? `${word} starting` : `${word} soon`
  }

  // Composite helper — only formed when both parts are present
  function compose(context: string): string {
    return soon ? `${context} · ${upLabel(true)}` : context
  }

  // ── 1. Hot activity (0–30 min) — dominant, no composite ──────────────────
  if (hot.length >= 1) {
    if (isTeam)    return hot.length >= 2 ? 'Practice active' : 'Team active'
    if (hour < 11) return 'Morning flow'
    if (hour < 14) return 'In flow'
    if (hour < 17) return 'Busy afternoon'
    if (hour < 21) return 'Settling down'
    return 'Winding down'
  }

  // ── 1b. Warm activity (30–60 min) — no composite ─────────────────────────
  if (warm.length >= 1) {
    if (isTeam)    return 'Team active'
    if (hour < 11) return 'Morning flow'
    if (hour < 17) return 'In flow'
    if (hour < 21) return 'Settling down'
    return 'Winding down'
  }

  // ── 2. Moderate activity (1–4h) ───────────────────────────────────────────
  // Presence may form composite with upcoming; time-of-day phrases stay solo.
  if (h4.length >= 1) {
    const c = ctx()
    if (c) return compose(c)                    // e.g. "Everyone home · dinner soon"
    if (hour < 11) return 'Active morning'
    if (hour < 17) return 'Active earlier'
    if (hour < 21) return 'Quieter now'
    return 'Quiet evening'
  }

  // ── 3. No moderate activity — presence + upcoming, or upcoming alone ──────
  if (soon) {
    const c = ctx()
    return c ? compose(c) : upLabel()           // "Team gathering · game soon" or "Dinner soon"
  }

  // ── 4. Environmental modifier ─────────────────────────────────────────────
  const wp = weatherPhrase(weather, hour)
  if (wp) return wp

  // ── 5. Older activity (4–24h) + presence ─────────────────────────────────
  if (h24.length >= 1) {
    const c = ctx()
    if (c === 'Everyone home' || c === 'Team gathering') return c
    if (hour < 11) return 'Calm morning'
    if (hour < 17) return 'Light day'
    if (hour < 21) return 'Calm evening'
    return 'Quiet night'
  }

  // ── 6. Quiet fallback ─────────────────────────────────────────────────────
  if (hour < 11) return 'Quiet morning'
  if (hour < 17) return 'Quiet afternoon'
  if (hour < 21) return 'Calm evening'
  return 'Still'
}

// ─── Presence helpers ──────────────────────────────────────────────────────────
// Decay: 0–10h → show current state   10h+ → hide row entirely


function presenceAgeHours(m: Member): number {
  return (Date.now() - new Date(m.presence_updated_at || m.created_at).getTime()) / 3_600_000
}


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

// ─── Nudge state (localStorage) ───────────────────────────────────────────────

const NUDGE_COOLDOWN_MS = 90 * 60_000  // 90 minutes between nudges

function loadNudgesDisabled(spaceId: string): boolean {
  try { return localStorage.getItem(`dw_nudges_off_${spaceId}`) === '1' } catch { return false }
}

function saveNudgesDisabled(spaceId: string, val: boolean) {
  try {
    if (val) localStorage.setItem(`dw_nudges_off_${spaceId}`, '1')
    else localStorage.removeItem(`dw_nudges_off_${spaceId}`)
  } catch {}
}

function loadNudgeCooldown(): number {
  try { return parseInt(localStorage.getItem('dw_nudge_cooldown') || '0', 10) } catch { return 0 }
}

function saveNudgeCooldown() {
  try { localStorage.setItem('dw_nudge_cooldown', String(Date.now())) } catch {}
}

function nudgeCooledDown(): boolean {
  return Date.now() - loadNudgeCooldown() >= NUDGE_COOLDOWN_MS
}

function isQuietHours(): boolean {
  const h = new Date().getHours()
  return h >= 23 || h < 7
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

  const activeMemberId = memberId

  const [space,            setSpace]            = useState<Space | null>(null)
  const [members,          setMembers]          = useState<Member[]>([])
  const [serverEvents,     setServerEvents]     = useState<Event[]>([])
  const [optimisticEvents, setOptimisticEvents] = useState<Event[]>([])
  const [upcoming,         setUpcoming]         = useState<Upcoming[]>([])
  const [loading,          setLoading]          = useState(true)

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
  const [logExpanded,         setLogExpanded]         = useState(false)
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false)
  const [tapInFeedback,       setTapInFeedback]       = useState<string | null>(null)
  const [tappedState,         setTappedState]         = useState<string | null>(null)
  const [customText,          setCustomText]          = useState('')

  const recentTaps = useRef<Map<string, number>>(new Map())
  const customInputRef = useRef<HTMLInputElement>(null)
  const [expandedUpcomingId, setExpandedUpcomingId]   = useState<string | null>(null)
  const [weather,            setWeather]              = useState<WeatherCondition>(null)
  const [otherSpaces, setOtherSpaces] = useState<{ id: string; name: string }[]>([])

  // Wi-Fi nudge state
  type NudgeData = { message: string; confirmLabel: string; confirmState: string }
  const [nudge,          setNudge]          = useState<NudgeData | null>(null)
  const [nudgesDisabled, setNudgesDisabled] = useState(false)
  const nudgeDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Name tap — "finger" tooltip
  const [tappedMemberId, setTappedMemberId] = useState<string | null>(null)
  const presenceRef  = useRef<HTMLDivElement>(null)
  const whRef        = useRef<HTMLDivElement>(null)
  const tapInTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Query state — when Tap In was last opened
  const [queriedAt, setQueriedAt] = useState<number | null>(null)
  // Tick every 30s to update elapsed display
  const [tick, setTick] = useState(0)
  // Live clock for upcoming calculations
  const [nowMs, setNowMs] = useState(() => Date.now())

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    const now4h = new Date(Date.now() + 4 * 3_600_000).toISOString()
    const [spaceRes, membersRes, eventsRes, upcomingRes] = await Promise.all([
      supabase.from('spaces').select('*').eq('id', spaceId).single(),
      supabase.from('members').select('*').eq('space_id', spaceId).order('created_at'),
      supabase
        .from('events')
        .select('*, member:members(id, display_name)')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(80),
      supabase
        .from('upcoming')
        .select('*')
        .eq('space_id', spaceId)
        .gte('starts_at', new Date().toISOString())
        .lte('starts_at', now4h)
        .order('starts_at')
        .limit(5),
    ])
    if (spaceRes.data)   setSpace(spaceRes.data)
    if (membersRes.data) {
      setMembers(membersRes.data)
      console.log('[fetchAll] member_id:', memberId, '| members fetched:', membersRes.data.length, '| ids:', membersRes.data.map((m: Member) => m.id))
    }
    if (eventsRes.data)  setServerEvents(eventsRes.data as Event[])
    if (upcomingRes.data) setUpcoming(upcomingRes.data)
    setLoading(false)
  }, [spaceId])

  useEffect(() => {
    fetchAll()
    const ch = supabase
      .channel(`space-${spaceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'members', filter: `space_id=eq.${spaceId}` }, (payload) => {
        setMembers(prev => [...prev, payload.new as Member])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members', filter: `space_id=eq.${spaceId}` }, (payload) => {
        setMembers(prev => prev.map(m => m.id === (payload.new as Member).id ? payload.new as Member : m))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events',   filter: `space_id=eq.${spaceId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upcoming', filter: `space_id=eq.${spaceId}` }, fetchAll)
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

  // Live clock for upcoming / placecard computations
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(i)
  }, [])

  // Weather — one fetch per session, silent failure
  useEffect(() => {
    getWeatherCondition().then(setWeather)
  }, [])

  // Load nudge disabled flag from localStorage
  useEffect(() => {
    setNudgesDisabled(loadNudgesDisabled(spaceId))
  }, [spaceId])

  // Wi-Fi based presence nudges — soft prompts on network type change
  useEffect(() => {
    if (!activeMemberId || nudgesDisabled) return

    function tryNudge(type: NetworkType) {
      if (nudgesDisabled || !nudgeCooledDown() || isQuietHours()) return
      const n = space?.name?.toLowerCase() ?? ''
      const isWork = /office|work|hq|studio|clinic|lab|desk/.test(n)
      const isTeam = /team|practice|league|gym|court|dance|volleyball|soccer|hockey|yoga/.test(n)

      if (type === 'wifi') {
        const message      = isWork ? 'At work?' : isTeam ? 'At the venue?' : 'You\'re home?'
        const confirmLabel = isWork ? 'At work' : isTeam ? 'Here' : 'Home'
        const confirmState = isWork ? 'at_work' : 'home'
        setNudge({ message, confirmLabel, confirmState })
      } else {
        const message = isWork ? 'Left the office?' : 'Left home?'
        setNudge({ message, confirmLabel: 'Away', confirmState: 'away' })
      }
    }

    const cleanup = onNetworkChange(type => {
      if (nudgeDwellTimer.current) clearTimeout(nudgeDwellTimer.current)
      const dwell = type === 'wifi' ? 90_000 : 3 * 60_000
      nudgeDwellTimer.current = setTimeout(() => tryNudge(type), dwell)
    })

    return () => {
      cleanup()
      if (nudgeDwellTimer.current) clearTimeout(nudgeDwellTimer.current)
    }
  }, [activeMemberId, nudgesDisabled, space?.name])

  // Dismiss W.H. on outside click
  useEffect(() => {
    if (!logExpanded) return
    function handleOutside(e: MouseEvent) {
      if (whRef.current && !whRef.current.contains(e.target as Node)) {
        setLogExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [logExpanded])

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
    if (logExpanded) {
      setLogExpanded(false)
      setSuggestionsExpanded(false)
      return
    }
    const ts = Date.now()
    setQueriedAt(ts)
    saveQueriedAt(spaceId, ts)
    setLogExpanded(true)
  }

  function tapIn(emoji: string, label: string) {
    console.log('[tapIn] called with:', { emoji, label })
    logEvent(emoji, label)
    recentTaps.current.set(label, Date.now())
    setTapInFeedback(label)
    if (tapInTimer.current) clearTimeout(tapInTimer.current)
    tapInTimer.current = setTimeout(() => setTapInFeedback(null), 1200)
  }

  async function logEvent(emoji: string, label: string, note?: string) {
    const bulk = parseBulk(label)
    const mid  = activeMemberId || null
    console.log('[logEvent] member_id used for insert:', mid)
    if (!mid) {
      console.error('[logEvent] blocked: no member_id — cannot insert event')
      return
    }
    const now  = Date.now()

    if (bulk.length >= 2) {
      const newOptimistic = bulk.map((lbl, i) => ({
        id: `opt-${now}-${i}`, space_id: spaceId, member_id: mid,
        emoji: '', label: lbl, note: null,
        created_at: new Date(now - i * 500).toISOString(),
      }))
      setOptimisticEvents(prev => [...newOptimistic, ...prev])
      closeSheet(); setLogExpanded(false); setQueriedAt(null); clearQueriedAt(spaceId)
      try {
        await Promise.all(bulk.map(lbl =>
          supabase.from('events').insert({ space_id: spaceId, member_id: mid, emoji: '', label: lbl })
        ))
        // Insert succeeded — fetchAll will update serverEvents; dedup removes optimistic seamlessly
        fetchAll()
      } catch (err) {
        // Insert failed — discard optimistic events immediately
        console.error('[logEvent] bulk insert failed:', err)
        setOptimisticEvents(prev => prev.filter(e => !newOptimistic.some(o => o.id === e.id)))
      }
    } else {
      const optEvent: Event = {
        id: `opt-${now}`, space_id: spaceId, member_id: mid,
        emoji, label, note: note?.trim() || null,
        created_at: new Date(now).toISOString(),
      }
      setOptimisticEvents(prev => [optEvent, ...prev])
      closeSheet(); setLogExpanded(false); setQueriedAt(null); clearQueriedAt(spaceId)
      try {
        await supabase.from('events').insert({
          space_id: spaceId, member_id: mid, emoji, label,
          ...(note?.trim() ? { note: note.trim() } : {}),
        })
        fetchAll()
      } catch (err) {
        console.error('[logEvent] single insert failed:', err)
        setOptimisticEvents(prev => prev.filter(e => e.id !== optEvent.id))
      }
    }
  }

  async function setPresence(state: string) {
    if (!activeMemberId) return
    const now = new Date().toISOString()
    const patch = (m: Member) =>
      m.id === activeMemberId
        ? { ...m, presence_state: state as Member['presence_state'], presence_updated_at: now }
        : m
    setMembers(prev => prev.map(patch))
    await supabase.from('members').update({ presence_state: state, presence_updated_at: now }).eq('id', activeMemberId)
  }

  function handleJoinState(label: string) {
    if (!activeMemberId) return
    const now = new Date().toISOString()
    const patch = (m: Member) =>
      m.id === activeMemberId
        ? { ...m, presence_state: label as Member['presence_state'], presence_updated_at: now }
        : m
    setMembers(prev => prev.map(patch))
    supabase.from('members').update({ presence_state: label, presence_updated_at: now }).eq('id', activeMemberId)
  }

  // Cross-space echo: update presence on all member records belonging to this user
  async function setPresenceAllSpaces(state: string) {
    await setPresence(state)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase.from('members')
      .update({ presence_state: state, presence_updated_at: now })
      .eq('user_id', user.id)
      .neq('id', activeMemberId)
  }

  function handleUpcomingAction(action: 'here' | 'on_the_way' | 'running_late', label: string) {
    if (action === 'here') {
      setPresence('home')
    } else if (action === 'on_the_way') {
      setPresence('out')
      logEvent('', `On the way · ${label}`)
    } else {
      setPresence('out')
      logEvent('', `Running late · ${label}`)
    }
    setExpandedUpcomingId(null)
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
    setServerEvents(prev => prev.filter(e => e.id !== eventId))
    await supabase.from('events').delete().eq('id', eventId)
    fetchAll()
  }

  // ─── Derived state ──────────────────────────────────────────────────────────

  // Suppress unused tick warning — it's only there to force re-render for query elapsed time
  void tick

  // Merge optimistic + server events. Optimistic events that have been persisted
  // (matched by label + created_at within 10s) are filtered out to prevent duplicates.
  const combinedEvents: Event[] = [
    ...optimisticEvents.filter(opt =>
      !serverEvents.some(s =>
        s.label === opt.label &&
        Math.abs(new Date(s.created_at).getTime() - new Date(opt.created_at).getTime()) < 10_000
      )
    ),
    ...serverEvents,
  ]

  const cutoff12h     = new Date(nowMs - 12 * 3_600_000)

  const upcomingAsEvents: Event[] = upcoming
    .filter(u => new Date(u.starts_at).getTime() > nowMs)
    .map(u => ({
      id: `up-${u.id}`,
      space_id: u.space_id,
      member_id: null,
      emoji: '',
      label: u.label,
      note: null,
      created_at: u.starts_at,
      starts_at: u.starts_at,
    }))

  // Build map of latest recent activity per member (within 30 min) — used by CURRENT
  const recentActivityByMemberId = buildRecentActivityMap(combinedEvents, nowMs)

  // IDs currently shown as the active state in CURRENT — exclude from TODAY to avoid duplication
  const activeInCurrentIds = new Set([...recentActivityByMemberId.values()].map(e => e.id))

  const todayEvents   = combinedEvents.filter(e => {
    const isInPast = new Date(e.created_at) >= cutoff12h
    const isNotFuture = !e.starts_at || new Date(e.starts_at).getTime() <= nowMs
    return isInPast && isNotFuture && !activeInCurrentIds.has(e.id)
  })
  const earlierEvents = combinedEvents.filter(e => new Date(e.created_at) < cutoff12h)
  const earlierGroups = groupByDay(earlierEvents)

  // All members, sorted by presence state (here first, away after), then by recency within each group
  const sortedMembers = [...members].sort((a, b) => {
    const stateOrder = { 'home': 0, 'away': 1, 'dnd': 2, 'tbd': 3 }
    const aOrder = stateOrder[a.presence_state as keyof typeof stateOrder] ?? 99
    const bOrder = stateOrder[b.presence_state as keyof typeof stateOrder] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return presenceAgeMs(a) - presenceAgeMs(b)
  })

  const summary = ambientSummary(combinedEvents, members, upcoming, space?.name ?? '', weather)
  const isOwner = members.find(m => m.id === activeMemberId)?.role === 'owner'

  // Progressive empty-state: classify space by signal count
  // empty → initializing → alive as events accumulate
  const signalCount = combinedEvents.length
  const spaceStage: 'empty' | 'initializing' | 'alive' =
    signalCount === 0 ? 'empty'       :
    signalCount <= 2  ? 'initializing' :
    'alive'
  const displaySummary = spaceStage === 'empty' ? 'Start by tapping in.' : summary

  const qTag     = queryTag(queriedAt)
  const qOpacity = queryTagOpacity(queriedAt)

  const isSearching   = searchQuery.trim().length > 0
  const searchResults = isSearching
    ? combinedEvents.filter(e => {
        const q = searchQuery.toLowerCase()
        return e.label.toLowerCase().includes(q) || (e.note?.toLowerCase().includes(q) ?? false)
      })
    : []

  const suggestMatches = addLabel.trim() && !showSignalPicker
    ? ALL_PRESETS.filter(p => matchesPreset(addLabel, p.label)).slice(0, 3)
    : []

  const bulkItems    = parseBulk(addLabel)
  const isBulk       = bulkItems.length >= 2

  // Adaptive suggestions — space type + time of day + recent behavior + network
  const suggestions: SuggestionItem[] = space
    ? buildSuggestions(space.name, combinedEvents, activeMemberId)
    : []

  // Presence chips (TAP IN) and activity chips (QUICK LOG) are kept separate
  const presenceChips  = buildPresenceChips()
  const activityChips  = space ? buildActivityChips(space.name, new Date().getHours(), recentTaps.current) : []

  // Active presence state for highlighting the current chip
  const myPresenceState = members.find(m => m.id === activeMemberId)?.presence_state ?? ''

  // Upcoming: within next 4h, max 2 shown
  const upcomingItems = upcoming.slice(0, 2)

  // Up to 3 most recent events attributed to a member (for name tap recall)
  function recentEventsFor(mid: string): Event[] {
    return combinedEvents.filter(e => e.member_id === mid).slice(0, 3)
  }

  // ─── Time-of-day warmth shift (restrained, subtle) ────────────────────────
  function computeWarmth(): number {
    const hour = new Date(nowMs).getHours()
    // 7am–5pm: near neutral, 5pm–9pm: slightly warm, 9pm–2am: warmest, 2am–7am: warm-moderate
    if (hour >= 7 && hour < 17) return 0        // daytime: neutral
    if (hour >= 17 && hour < 21) return 0.25    // early evening: slightly warm
    if (hour >= 21 || hour < 2) return 0.5      // late night: warmest
    return 0.3                                  // early morning: warm-moderate
  }

  const warmth = computeWarmth()

  // Interpolate colors based on warmth factor
  function interpColor(coolHex: string, warmHex: string, w: number): string {
    const cool = parseInt(coolHex.slice(1), 16)
    const warm = parseInt(warmHex.slice(1), 16)
    const coolR = (cool >> 16) & 0xff
    const coolG = (cool >> 8) & 0xff
    const coolB = cool & 0xff
    const warmR = (warm >> 16) & 0xff
    const warmG = (warm >> 8) & 0xff
    const warmB = warm & 0xff
    const r = Math.round(coolR + (warmR - coolR) * w)
    const g = Math.round(coolG + (warmG - coolG) * w)
    const b = Math.round(coolB + (warmB - coolB) * w)
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  const cardBg = interpColor('#FCFBF8', '#F8F3EC', warmth)
  const dividerColor = interpColor('#EDE9E3', '#E8DFD5', warmth)
  const mutedText = interpColor('#9CA3AF', '#B5A896', warmth)

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
    <div className={`min-h-screen ${timeOfDayBg()} lg:bg-slate-50`}>
      <div className="mx-auto w-full max-w-[480px] md:max-w-[640px] xl:max-w-[760px] px-3 py-4 min-h-screen flex flex-col">
        <div className="rounded-2xl shadow-sm pb-24 flex-1" style={{ background: cardBg }}>

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
          <p className="mt-1 text-[13px]" style={{ color: '#374151', fontStyle: 'italic', fontWeight: 300 }}>
            {displaySummary}
          </p>
        </header>

        {/* ── NUDGE BAR ─────────────────────────────────────────────────────── */}
        {nudge && !nudgesDisabled && (
          <div className="mx-5 mb-1 px-4 py-2.5 rounded-xl flex items-center justify-between" style={{ background: '#F4F1EC' }}>
            <span style={{ fontSize: '13px', color: '#4A453F' }}>{nudge.message}</span>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <button
                onClick={() => {
                  setPresenceAllSpaces(nudge.confirmState)
                  setNudge(null)
                  saveNudgeCooldown()
                }}
                style={{
                  fontSize: '12px', fontWeight: 500,
                  color: '#FFF', padding: '3px 10px',
                  borderRadius: '999px', background: '#1A1A18',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {nudge.confirmLabel}
              </button>
              <button
                onClick={() => { setNudge(null); saveNudgeCooldown() }}
                style={{ fontSize: '12px', color: '#9CA3AF', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── CURRENT ──────────────────────────────────────────────────────── */}
        {(() => {
          const visibleMembers = sortedMembers
          console.log('[CURRENT] member_id:', activeMemberId, '| members fetched:', members.length, '| member_ids in CURRENT:', visibleMembers.map(m => m.id))
          if (visibleMembers.length === 0) return null
          return (
            <section className="px-5 pb-5 lg:pb-4">
              <Label>Current</Label>
              <div className="mt-2 space-y-2">
                {visibleMembers.map(m => {
                  const recentActivity = recentActivityByMemberId.get(m.id)
                  return (
                    <div key={m.id}>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: m.id === activeMemberId ? 500 : 400 }}>
                          {m.display_name}
                        </span>
                        <span style={{ fontSize: '13px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {presenceDotColor(m.presence_state) && (
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: presenceDotColor(m.presence_state)!, flexShrink: 0 }} />
                          )}
                          {activeMemberId && m.id !== activeMemberId ? (
                            <button
                              onClick={() => handleJoinState(m.presence_state)}
                              style={{ color: 'inherit', font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                              className="opacity-80 hover:opacity-100 active:scale-[0.98] transition"
                            >
                              {formatPresence(m)}
                            </button>
                          ) : (
                            <span>{formatPresence(m)}</span>
                          )}
                          {m.presence_state !== 'tbd' && (
                            <>{' '}· {formatTime(m.presence_updated_at || m.created_at)}</>
                          )}
                        </span>
                      </div>
                      {recentActivity && (
                        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px', marginLeft: '0' }}>
                          {recentActivity.emoji && <span>{recentActivity.emoji} </span>}
                          <span>{recentActivity.label}</span>
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })()}

        {/* ── TAP IN (presence) ─────────────────────────────────────────────── */}
        {!isSearching && activeMemberId && (
          <section className="px-5 pb-4 lg:pb-3">
            <Label>Tap in</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presenceChips.map(chip => {
                const isActive = myPresenceState === chip.state
                return (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setPresence(chip.state)
                      setTappedState(chip.state)
                      setTimeout(() => setTappedState(null), 250)
                    }}
                    style={{
                      display:      'inline-flex',
                      alignItems:   'center',
                      padding:      '6px 14px',
                      borderRadius: '999px',
                      background:   tappedState === chip.state ? '#D1D5DB' : isActive ? '#1A1A18' : '#F4F1EC',
                      fontSize:     '13px',
                      color:        isActive && tappedState !== chip.state ? '#FFFFFF' : '#3A3630',
                      fontWeight:   isActive ? 500 : 400,
                      border:       'none',
                      cursor:       'pointer',
                      transition:   'background 150ms ease',
                    }}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>
          </section>
        )}


        {/* ── QUICK LOG ─────────────────────────────────────────────────────── */}
        {!isSearching && (
          <section ref={whRef} className="px-5 pb-5 lg:pb-4">
            <Label>Quick log</Label>
            <div className="mt-2">
              {tapInFeedback ? (
                <p style={{ fontSize: '14px', color: '#4A453F' }}>✓ Logged: {tapInFeedback}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activityChips.map(chip => (
                    <button
                      key={chip.label}
                      onClick={() => tapIn(chip.emoji, chip.label)}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        padding:      '4px 12px',
                        borderRadius: '999px',
                        background:   '#F4F1EC',
                        fontSize:     '13px',
                        color:        '#3A3630',
                        border:       'none',
                        cursor:       'pointer',
                      }}
                    >
                      {chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label}
                    </button>
                  ))}
                </div>
              )}
              {!tapInFeedback && (() => {
                const quickEmojis = [
                  { icon: '🍽', label: 'Eating' },
                  { icon: '🚗', label: 'On the way' },
                  { icon: '🏠', label: 'Home' },
                  { icon: '😴', label: 'Sleeping' },
                  { icon: '😌', label: 'Relaxing' },
                ]
                return (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px', marginBottom: '2px' }}>
                    {quickEmojis.map(e => (
                      <button
                        key={e.icon}
                        type="button"
                        onClick={() => { setCustomText(e.label); customInputRef.current?.focus() }}
                        style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer', padding: '0', lineHeight: 1 }}
                      >
                        {e.icon}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {!tapInFeedback && (
                <form
                  style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}
                  onSubmit={async e => {
                    e.preventDefault()
                    const text = customText.trim()
                    console.log('[custom input] submitted:', { raw: customText, trimmed: text })
                    if (!text) return
                    const scheduled = parseScheduled(text)
                    console.log('[custom input] parseScheduled result:', scheduled)
                    if (scheduled) {
                      console.log('[custom input] entering scheduled branch')
                      try {
                        const { error } = await supabase
                          .from('upcoming')
                          .insert({ space_id: spaceId, label: scheduled.label, starts_at: scheduled.starts_at })
                        if (error) throw error

                        setUpcoming(prev =>
                          [...prev, { id: `opt-${Date.now()}`, space_id: spaceId, label: scheduled.label, starts_at: scheduled.starts_at, created_at: new Date().toISOString() }]
                            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                        )
                        setTapInFeedback(`${scheduled.label} · ${clockTime(scheduled.starts_at)}`)
                        if (tapInTimer.current) clearTimeout(tapInTimer.current)
                        tapInTimer.current = setTimeout(() => setTapInFeedback(null), 2000)
                      } catch (err) {
                        const error = err as any
                        console.error('[custom input] Upcoming insert failed:', {
                          message: error?.message,
                          details: error?.details,
                          hint: error?.hint,
                          code: error?.code,
                        })
                        console.log('[custom input] Falling back to plain log entry')
                        tapIn('', text)
                      }

                      setCustomText('')
                      return
                    }

                    console.log('[custom input] entering plain-log branch, calling tapIn')
                    tapIn('', text)
                    setCustomText('')
                  }}
                >
                  <input
                    ref={customInputRef}
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setCustomText('') } }}
                    placeholder="What's happening…"
                    style={{
                      flex: 1,
                      fontSize: '13px',
                      color: '#3A3630',
                      background: '#F4F1EC',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!customText.trim()}
                    style={{ fontSize: '13px', color: customText.trim() ? '#1A1A18' : '#9CA3AF', border: 'none', background: 'transparent', cursor: customText.trim() ? 'pointer' : 'default', padding: '0 4px' }}
                  >
                    Send
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* ── UPCOMING ─────────────────────────────────────────────────────── */}
        {!isSearching && upcomingItems.length > 0 && spaceStage === 'alive' && (
          <section className="px-5 pb-5 lg:pb-4">
            <Label>Upcoming</Label>
            <div className="mt-1 space-y-1">
              {upcomingItems.map(u => (
                <div key={u.id} onClick={() => handleJoinState(u.label)} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 0', cursor: activeMemberId ? 'pointer' : 'default' }}>
                  <span style={{ fontSize: '14px', color: '#5A554E' }}>
                    {u.label}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6E6A64', tabularNums: true } as React.CSSProperties}>
                    {formatCountdown(u.starts_at, nowMs)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Rule color={dividerColor} />

        {/* ── Search Results (replaces Today/Earlier when active) ────────────── */}
        {isSearching && (
          <section className="px-5 py-3">
            <Label>Results</Label>
            {searchResults.length > 0 ? (
              <div className="mt-2">
                {searchResults.map(e => (
                  <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} tick={tick} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm" style={{ color: '#C4C0B8' }}>No results.</p>
            )}
          </section>
        )}

        {/* ── TODAY ─────────────────────────────────────────────────────────── */}
        {!isSearching && todayEvents.length > 0 && (
          <section className="px-5 py-4 lg:py-3">
            <Label>Today</Label>
            {todayEvents.map((e, i) => (
              <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} isFirst={i === 0} tick={tick} nowMs={nowMs} />
            ))}
          </section>
        )}

        {/* ── 6. EARLIER ────────────────────────────────────────────────────── */}
        {!isSearching && earlierEvents.length > 0 && (
          <>
            <Rule color={dividerColor} />
            <section className="px-5 py-4 lg:py-3">
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
                      <EventRow key={e.id} event={e} activeMemberId={activeMemberId} onDelete={deleteEvent} tick={tick} nowMs={nowMs} />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── INVITE PROMPT (initializing state only) ──────────────────────── */}
        {!isSearching && spaceStage === 'initializing' && (
          <div className="px-5 pb-4">
            <button
              onClick={copyInviteLink}
              style={{
                fontSize:   '13px',
                color:      copied ? '#4A9' : '#B0ABA4',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                padding:    0,
              }}
            >
              {copied ? '✓ Link copied' : 'Invite someone to share this space →'}
            </button>
          </div>
        )}

        <Rule color={dividerColor} />

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

        <Rule color={dividerColor} />

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
  tick?: number
  nowMs?: number
}

function EventRow({ event, activeMemberId, onDelete, isFirst, tick, nowMs }: EventRowProps) {
  const now = nowMs ?? 0
  const canDelete = !!activeMemberId
    && event.member_id === activeMemberId
    && now > 0
    && now - new Date(event.created_at).getTime() < 10 * 60_000

  return (
    <div className="flex items-baseline justify-between" style={{ paddingTop: '5px', paddingBottom: '5px' }}>
      <div className="flex items-baseline gap-2 min-w-0 flex-1">
        {event.emoji && (
          <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>{event.emoji}</span>
        )}
        <div className="min-w-0">
          <span className="text-sm leading-snug" style={{ color: '#1f2937', fontWeight: isFirst ? 500 : 400 }}>{event.label}</span>
          {event.note && (
            <p className="text-xs mt-0.5 truncate" style={{ color: '#B8B4AC' }}>{event.note}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-4 shrink-0">
        <span className="text-xs tabular-nums" style={{ color: '#6b7280' }}>
          {event.starts_at && new Date(event.starts_at).getTime() > now
            ? formatCountdown(event.starts_at, now)
            : relativeTime(event.created_at, now)}
          {/* tick: {tick} */}
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

function Rule({ color = '#EDE9E3' }: { color?: string }) {
  return <div style={{ borderTop: `1px solid ${color}`, margin: '0 20px' }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 500 }}>
      {children}
    </p>
  )
}

function presenceDotColor(state: string): string | null {
  if (state === 'home') return '#86efac' // soft green
  if (state === 'away') return '#d1d5db' // soft gray
  if (state === 'dnd')  return '#fca5a5' // soft red
  return null
}

function formatPresence(member: Member): string {
  const state = member.presence_state
  if (state === 'home') return '✓ here'
  if (state === 'away') return 'away'
  if (state === 'dnd') return 'busy'
  return 'not here yet'
}

function formatTime(ts?: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return ''
}

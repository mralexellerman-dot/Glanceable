'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTrackedSpaceIds } from '@/lib/memberships'
import { getWeatherCondition } from '@/lib/weather'
import type { WeatherCondition } from '@/lib/weather'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeOfDayBg(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 11) return 'bg-stone-50'
  if (h >= 11 && h < 16) return 'bg-stone-100'
  if (h >= 16 && h < 21) return 'bg-amber-50'
  return 'bg-stone-100'
}

function relativeTime(dateStr: string): string {
  const now  = Date.now()
  const then = new Date(dateStr).getTime()
  const min  = Math.floor((now - then) / 60_000)
  const hr   = Math.floor(min / 60)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m`
  if (hr  < 5)  return `${hr}h`
  const todayDs = new Date(now).toDateString()
  const thenDs  = new Date(then).toDateString()
  if (thenDs === todayDs)                                    return 'earlier today'
  if (thenDs === new Date(now - 86_400_000).toDateString()) return 'yesterday'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getPlaceEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('church') || n.includes('chapel'))              return '⛪'
  if (n.includes('hospital') || n.includes('clinic'))            return '🏥'
  if (n.includes('cafe') || n.includes('coffee'))                return '☕'
  if (n.includes('office') || n.includes('hq') || n.includes('studio') || n.includes('work')) return '💼'
  if (n.includes('gym') || n.includes('court') || n.includes('team') || n.includes('practice')) return '🏐'
  if (n.includes('cabin') || n.includes('beach') || n.includes('lake')) return '🏕️'
  return '🏡'
}

// ─── Summary engine v2 ────────────────────────────────────────────────────────
// Priority: recent activity > presence > composite(presence·upcoming) > weather > quiet
// Composites ([context] · [upcoming]) only when activity is weak and upcoming is near.

function cardSummary(
  events:           { label: string; created_at: string }[],
  members:          CardMember[],
  weather:          WeatherCondition,
  spaceName:        string = '',
  nearestUpcoming?: { label: string; starts_at: string },
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

  // Presence — members updated within 10h
  const visibleM = members.filter(m => {
    const ts = m.presence_updated_at || ''
    return ts && (now - new Date(ts).getTime()) / 3_600_000 < 10
  })
  const homeN = visibleM.filter(m => m.presence_state === 'home').length
  const awayN = visibleM.length - homeN

  // Presence context phrase — null when not strong enough to surface
  function ctx(): string | null {
    if (visibleM.length < 2) return null
    if (isTeam)     return awayN === 0 ? 'Team gathering' : null
    if (awayN === 0) return 'Everyone home'
    if (homeN === 0) return 'Everyone out'
    return 'House split'
  }

  // Upcoming label (capitalised standalone; lowercase after ·)
  let soonMins = Infinity
  if (nearestUpcoming) {
    soonMins = (new Date(nearestUpcoming.starts_at).getTime() - now) / 60_000
  }
  const hasSoon = soonMins > 0 && soonMins <= 120

  function upLabel(lower = false): string {
    if (!nearestUpcoming || !hasSoon) return ''
    const raw  = nearestUpcoming.label.trim().split(/\s+/)[0]
    const word = lower ? raw.toLowerCase()
                       : raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    return soonMins <= 30 ? `${word} starting` : `${word} soon`
  }

  function compose(context: string): string {
    return hasSoon ? `${context} · ${upLabel(true)}` : context
  }

  // ── 1. Hot activity ───────────────────────────────────────────────────────
  if (hot.length >= 1) {
    if (isTeam)    return hot.length >= 2 ? 'Practice active' : 'Team active'
    if (hour < 11) return 'Morning flow'
    if (hour < 14) return 'In flow'
    if (hour < 17) return 'Busy afternoon'
    if (hour < 21) return 'Settling down'
    return 'Winding down'
  }

  // ── 1b. Warm activity ─────────────────────────────────────────────────────
  if (warm.length >= 1) {
    if (isTeam)    return 'Team active'
    if (hour < 11) return 'Morning flow'
    if (hour < 17) return 'In flow'
    if (hour < 21) return 'Settling down'
    return 'Winding down'
  }

  // ── 2. Moderate activity (1–4h) ───────────────────────────────────────────
  if (h4.length >= 1) {
    const c = ctx()
    if (c) return compose(c)
    if (hour < 17) return 'Active earlier'
    if (hour < 21) return 'Quieter now'
    return 'Quiet evening'
  }

  // ── 3. No moderate activity — presence + upcoming, or upcoming alone ──────
  if (hasSoon) {
    const c = ctx()
    return c ? compose(c) : upLabel()
  }

  // ── 4. Environmental modifier ─────────────────────────────────────────────
  if (weather) {
    const tod = hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'
    const adj = weather === 'rain'  ? 'Rainy'
              : weather === 'storm' ? 'Stormy'
              : weather === 'snow'  ? 'Snowy'
              : 'Hot'
    return `${adj} ${tod}`
  }

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CardMember = { space_id?: string; display_name: string; presence_state: string; presence_updated_at?: string | null }


function effectivePresenceState(m: CardMember): string {
  const ts       = m.presence_updated_at || ''
  const ageHours = ts ? (Date.now() - new Date(ts).getTime()) / 3_600_000 : Infinity
  if (ageHours > 10) return 'unknown'
  if (m.presence_state === 'home') return 'home'
  if (m.presence_state === 'dnd')  return 'quiet'
  // out, at_work, away all read as away on the placecard
  return 'away'
}

function buildPresenceLine(members: CardMember[]): string {
  // Omit members whose presence hasn't been updated in 10h — too stale to be useful
  const visible = members.filter(m => {
    const ts = m.presence_updated_at || ''
    if (!ts) return false
    return (Date.now() - new Date(ts).getTime()) / 3_600_000 < 10
  })
  if (visible.length === 0) return ''

  if (visible.length <= 3) {
    return visible.map(m => `${m.display_name} ${effectivePresenceState(m)}`).join(' · ')
  }

  // Aggregated counts using decayed state
  const homeCount    = visible.filter(m => effectivePresenceState(m) === 'home').length
  const awayCount    = visible.filter(m => effectivePresenceState(m) === 'away' || effectivePresenceState(m) === 'quiet').length
  const unknownCount = visible.filter(m => effectivePresenceState(m) === 'unknown').length
  const parts: string[] = []
  if (homeCount    > 0) parts.push(`${homeCount} here`)
  if (awayCount    > 0) parts.push(`${awayCount} away`)
  if (unknownCount > 0) parts.push(`${unknownCount} unknown`)
  return parts.join(' · ')
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CardEvent = { text: string; time: string }

interface PlaceCardData {
  id:         string
  name:       string
  icon?:      string
  presence?:  string
  summary:    string
  events:     CardEvent[]
  freshness?: string   // most recent update — shown subtly in title row
  isDemo?:    boolean
}

// ─── Demo cards ───────────────────────────────────────────────────────────────

function buildDemoCards(): PlaceCardData[] {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
  return [
    {
      id:       'demo-family-home',
      name:     'Family Home',
      icon:     '🏡',
      presence: 'Mom home · Dad away',
      summary:  'Settling down',
      freshness: relativeTime(ago(10)),
      events: [
        { text: 'Dinner started',  time: relativeTime(ago(10))  },
        { text: 'Laundry running', time: relativeTime(ago(25))  },
        { text: 'Dog fed',         time: relativeTime(ago(60))  },
        { text: 'Amazon delivered',time: relativeTime(ago(120)) },
        { text: 'School drop-off', time: relativeTime(ago(360)) },
        { text: 'Coffee run',      time: relativeTime(ago(480)) },
      ],
      isDemo: true,
    },
    {
      id:        'demo-volleyball',
      name:      'Volleyball Team',
      icon:      '🏐',
      presence:  '8 here · 2 away',
      summary:   'Practice active',
      freshness: relativeTime(ago(8)),
      events: [
        { text: 'Drills',           time: relativeTime(ago(8))   },
        { text: 'Scrimmage',        time: relativeTime(ago(22))  },
        { text: 'Warmup started',   time: relativeTime(ago(35))  },
        { text: 'Water break',      time: relativeTime(ago(40))  },
        { text: 'Players arriving', time: relativeTime(ago(60))  },
        { text: 'Bus departed',     time: relativeTime(ago(120)) },
      ],
      isDemo: true,
    },
  ]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RawSpaceData = {
  ids:      string[]
  spaces:   { id: string; name: string }[]
  events:   { space_id: string; emoji: string; label: string; created_at: string }[]
  upcoming: { space_id: string; label: string; starts_at: string }[]
  members:  CardMember[]
}

export default function Home() {
  const router = useRouter()
  const [demoCards]  = useState<PlaceCardData[]>(buildDemoCards)
  const [rawData,  setRawData]  = useState<RawSpaceData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [weather,  setWeather]  = useState<WeatherCondition>(null)

  useEffect(() => {
    async function load() {
      const ids = getTrackedSpaceIds()
      if (ids.length === 0) { setLoading(false); return }

      const now4h = new Date(Date.now() + 4 * 3_600_000).toISOString()
      const [spacesRes, eventsRes, upcomingRes, membersRes] = await Promise.all([
        supabase.from('spaces').select('id, name').in('id', ids),
        supabase
          .from('events').select('space_id, emoji, label, created_at')
          .in('space_id', ids).order('created_at', { ascending: false }).limit(200),
        supabase
          .from('upcoming').select('space_id, label, starts_at')
          .in('space_id', ids)
          .gte('starts_at', new Date().toISOString())
          .lte('starts_at', now4h)
          .order('starts_at'),
        supabase
          .from('members').select('space_id, display_name, presence_state, presence_updated_at')
          .in('space_id', ids),
      ])

      setRawData({
        ids,
        spaces:   spacesRes.data   || [],
        events:   eventsRes.data   || [],
        upcoming: upcomingRes.data || [],
        members:  membersRes.data  || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  // Weather — one fetch per session, updates summaries when resolved
  useEffect(() => {
    getWeatherCondition().then(setWeather)
  }, [])

  // Derive cards from raw data + weather so summaries react to both
  const realCards: PlaceCardData[] = rawData
    ? rawData.ids
        .map(id => rawData.spaces.find(s => s.id === id))
        .filter(Boolean)
        .map(s => {
          const sid             = s!.id
          const spaceEvents     = rawData.events.filter(e => e.space_id === sid)
          const spaceMembers    = rawData.members.filter(m => m.space_id === sid)
          const nearestUpcoming = rawData.upcoming.find(u => u.space_id === sid)
          const top2 = spaceEvents.slice(0, 2).map(e => ({
            text: e.emoji ? `${e.emoji} ${e.label}` : e.label,
            time: relativeTime(e.created_at),
          }))

          // Most recent update: latest event or presence change
          const allTs = [
            spaceEvents[0]?.created_at,
            ...spaceMembers.map(m => m.presence_updated_at ?? undefined),
          ].filter((ts): ts is string => !!ts)
          const latestTs = allTs.reduce<string | null>(
            (best, ts) => !best || ts > best ? ts : best, null
          )

          return {
            id:        sid,
            name:      s!.name,
            icon:      getPlaceEmoji(s!.name),
            presence:  buildPresenceLine(spaceMembers),
            summary:   cardSummary(spaceEvents, spaceMembers, weather, s!.name, nearestUpcoming ?? undefined),
            freshness: latestTs ? relativeTime(latestTs) : undefined,
            events:    top2,
          }
        })
    : []

  const allCards = loading ? demoCards : [...realCards, ...demoCards]

  return (
    <div className={`min-h-screen ${timeOfDayBg()}`}>
      <div className="mx-auto max-w-[480px] px-3 pt-5 pb-10">

        {/* HEADER */}
        <div className="px-1 pb-3">
          <span className="text-[15px] font-semibold text-gray-900">Glanceable</span>
        </div>

        {/* CARD STACK */}
        <div className="space-y-2">
          {allCards.map(card => (
            <PlaceCard
              key={card.id}
              card={card}
              onClick={() => card.isDemo ? router.push('/create') : router.push(`/space/${card.id}`)}
            />
          ))}
        </div>

        {/* ADD SPACE */}
        <Link
          href="/create"
          className="block w-full text-center py-3 mt-2 rounded-xl text-[13px]"
          style={{ color: '#B0ABA4', background: 'rgba(0,0,0,0.03)' }}
        >
          + Add space
        </Link>

      </div>
    </div>
  )
}

// ─── PlaceCard ────────────────────────────────────────────────────────────────

function PlaceCard({ card, onClick }: { card: PlaceCardData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-white active:opacity-70"
      style={{ padding: '11px 16px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
    >
      {/* TITLE ROW */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {card.icon && (
            <span className="shrink-0" style={{ fontSize: '12px', opacity: 0.45 }}>
              {card.icon}
            </span>
          )}
          <span className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            {card.name}
          </span>
        </div>
        <span className="ml-2 shrink-0 tabular-nums" style={{ fontSize: '11px', color: '#9CA3AF' }}>
          {card.isDemo
            ? <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '10px' }}>Demo</span>
            : card.freshness}
        </span>
      </div>

      {/* PRESENCE */}
      {card.presence && (
        <p className="truncate" style={{ fontSize: '12px', color: '#6B7280', marginBottom: '3px' }}>
          {card.presence}
        </p>
      )}

      {/* SUMMARY */}
      <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: 1.3, marginBottom: '5px' }}>
        {card.summary}
      </p>

      {/* ACTIVITY — max 2 rows */}
      {card.events.slice(0, 2).map((e, i) => (
        <div key={i} className="flex items-baseline justify-between" style={{ marginTop: i === 0 ? 0 : '1px' }}>
          <span className="truncate" style={{ fontSize: '12px', color: '#4B5563', marginRight: '8px' }}>
            {e.text}
          </span>
          <span className="shrink-0 tabular-nums" style={{ fontSize: '11px', color: '#9CA3AF' }}>
            {e.time}
          </span>
        </div>
      ))}
    </button>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTrackedSpaceIds } from '@/lib/memberships'

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

function getPlaceEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('cafe') || n.includes('coffee')) return '☕'
  if (n.includes('office') || n.includes('studio') || n.includes('hq')) return '🏢'
  if (n.includes('gym') || n.includes('court')) return '🏋️'
  if (n.includes('cabin') || n.includes('beach') || n.includes('lake')) return '🏕️'
  return '🏠'
}

// Short ambient state for the card (no evidence — just the state word)
function cardState(events: CardEvent[]): string {
  const now  = Date.now()
  const hour = new Date().getHours()
  const inLast = (h: number) =>
    events.filter(e => now - new Date(e.created_at).getTime() < h * 3_600_000)
  if (inLast(2).length  >= 1) return 'Settling down'
  if (inLast(6).length  >= 1) return 'Active earlier'
  if (inLast(24).length >= 1) {
    if (hour < 10)  return 'Slow morning'
    if (hour >= 20) return 'Slow evening'
    return 'Light activity'
  }
  if (hour < 10)  return 'Slow morning'
  if (hour >= 20) return 'Slow evening'
  return 'Quiet now'
}

// Anonymous presence dots: ●●○ format, max 3, filled = home+recent
// Returns empty string if no members
function presenceDots(
  members: Array<{ presence_state: string; presence_updated_at?: string | null; created_at: string }>
): string {
  if (members.length === 0) return ''
  const now     = Date.now()
  const active  = members.filter(m => {
    if (m.presence_state !== 'home') return false
    const ts = m.presence_updated_at || m.created_at
    return (now - new Date(ts).getTime()) / 3_600_000 < 8
  }).length
  const nDots   = Math.min(3, members.length)
  const nFilled = Math.min(active, nDots)
  return '●'.repeat(nFilled) + '○'.repeat(nDots - nFilled)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardEvent { emoji: string; label: string; created_at: string }

interface PlaceCardData {
  id:          string
  name:        string
  emoji:       string
  state:       string       // 2–3 word ambient state, no evidence
  dots:        string       // e.g. "●●○" or ""
  recentEvent: CardEvent | null  // single most recent event
  isDemo?:     boolean
}

// ─── Demo cards ───────────────────────────────────────────────────────────────

function buildDemoCards(): PlaceCardData[] {
  const m = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
  return [
    {
      id:    'demo-maple',
      name:  'Maple House',
      emoji: '🏠',
      state: 'Settling down',
      dots:  '●●○',
      recentEvent: { emoji: '', label: 'Dinner started', created_at: m(68) },
      isDemo: true,
    },
    {
      id:    'demo-studio',
      name:  'Studio 4B',
      emoji: '🏢',
      state: 'Active earlier',
      dots:  '●○○',
      recentEvent: { emoji: '', label: 'Laundry running', created_at: m(210) },
      isDemo: true,
    },
    {
      id:    'demo-beach',
      name:  'Beach Cabin',
      emoji: '🏕️',
      state: 'Quiet now',
      dots:  '○○○',
      recentEvent: { emoji: '', label: 'Dog fed', created_at: m(370) },
      isDemo: true,
    },
  ]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()
  const [demoCards] = useState<PlaceCardData[]>(buildDemoCards)
  const [realCards, setRealCards] = useState<PlaceCardData[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const ids = getTrackedSpaceIds()
      if (ids.length === 0) { setLoading(false); return }

      const [spacesRes, eventsRes, membersRes] = await Promise.all([
        supabase.from('spaces').select('id, name').in('id', ids),
        supabase
          .from('events').select('space_id, emoji, label, created_at')
          .in('space_id', ids).order('created_at', { ascending: false }).limit(100),
        supabase
          .from('members').select('space_id, presence_state, presence_updated_at, created_at')
          .in('space_id', ids),
      ])

      const spaces  = spacesRes.data  || []
      const events  = eventsRes.data  || []
      const members = membersRes.data || []

      const cards: PlaceCardData[] = ids
        .map(id => spaces.find(s => s.id === id))
        .filter(Boolean)
        .map(s => {
          const sid          = s!.id
          const spaceEvents  = events.filter(e => e.space_id === sid)
          const spaceMembers = members.filter(m => m.space_id === sid)
          return {
            id:          sid,
            name:        s!.name,
            emoji:       getPlaceEmoji(s!.name),
            state:       cardState(spaceEvents),
            dots:        presenceDots(spaceMembers),
            recentEvent: spaceEvents[0] ?? null,
          }
        })

      setRealCards(cards)
      setLoading(false)
    }
    load()
  }, [])

  const allCards = loading ? demoCards : [...realCards, ...demoCards]

  return (
    <main className="min-h-screen px-4 pt-8 pb-16" style={{ background: '#FAFAF8' }}>
      <div className="max-w-[960px] mx-auto">

        {/* ── App header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-sm font-semibold" style={{ color: '#333' }}>
            🏠 Dwellness
          </h1>
          <Link
            href="/create"
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
            style={{ background: '#1A1A18' }}
          >
            + Create
          </Link>
        </div>

        {/* ── Card grid ────────────────────────────────────────────────────── */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
          {allCards.map(card => (
            <PlaceCard
              key={card.id}
              card={card}
              onClick={() => card.isDemo ? router.push('/create') : router.push(`/space/${card.id}`)}
            />
          ))}
        </div>

      </div>
    </main>
  )
}

// ─── PlaceCard — exactly 3 lines ──────────────────────────────────────────────

function PlaceCard({ card, onClick }: { card: PlaceCardData; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3.5 transition-opacity active:opacity-70"
      style={{ background: '#FFFFFF', border: '1px solid #EBEBEA' }}
    >
      {/* Line 1: place name */}
      <p
        className="text-sm font-semibold truncate leading-snug"
        style={{ color: '#1A1A18' }}
      >
        {card.emoji} {card.name}
      </p>

      {/* Line 2: state (left) + presence dots (right) */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs" style={{ color: '#888' }}>
          {card.state}
        </span>
        {card.dots && (
          <span className="flex items-center gap-1 text-xs" style={{ color: '#999' }}>
            <span style={{ opacity: 0.5 }}>👥</span>
            <span style={{ letterSpacing: '1px', fontSize: '10px' }}>{card.dots}</span>
          </span>
        )}
      </div>

      {/* Line 3: most recent event */}
      <p
        className="text-xs mt-1.5 truncate"
        style={{ color: '#AAA' }}
      >
        {card.recentEvent
          ? `${card.recentEvent.emoji ? card.recentEvent.emoji + ' ' : ''}${card.recentEvent.label}`
          : <span style={{ fontStyle: 'italic' }}>—</span>
        }
      </p>
    </button>
  )
}

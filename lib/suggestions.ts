import type { Event } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SuggestionItem = { emoji: string; label: string }

type SuggestionClass = 'time-locked' | 'repeatable' | 'contextual'

type Candidate = SuggestionItem & {
  tags: string[]
  cls: SuggestionClass
  windows?: string[]
}

// ─── Candidate pool ───────────────────────────────────────────────────────────

const CANDIDATES: Candidate[] = [
  // ── Time-locked ────────────────────────────────────────────────────────────
  { emoji: '',   label: 'Getting coffee',  cls: 'time-locked', windows: ['morning'],           tags: ['home', 'work'] },
  { emoji: '',   label: 'School run',      cls: 'time-locked', windows: ['morning'],           tags: ['home'] },
  { emoji: '',   label: 'Quiet morning',   cls: 'time-locked', windows: ['morning'],           tags: ['home'] },
  { emoji: '',   label: 'Starting day',    cls: 'time-locked', windows: ['morning'],           tags: ['work'] },
  { emoji: '',   label: 'Lunch',           cls: 'time-locked', windows: ['midday'],            tags: ['work', 'wifi_work'] },
  { emoji: '',   label: 'Coffee break',    cls: 'time-locked', windows: ['midday'],            tags: ['work'] },
  { emoji: '🍝', label: 'Dinner started',  cls: 'time-locked', windows: ['evening'],           tags: ['home'] },
  { emoji: '',   label: 'Leaving office',  cls: 'time-locked', windows: ['evening'],           tags: ['work', 'wifi_work'] },
  { emoji: '',   label: 'On the way home', cls: 'time-locked', windows: ['evening'],           tags: ['cellular'] },
  { emoji: '',   label: 'Winding down',    cls: 'time-locked', windows: ['evening', 'night'],  tags: ['home'] },
  { emoji: '',   label: 'Bedtime',         cls: 'time-locked', windows: ['night'],             tags: ['home'] },

  // ── Repeatable ─────────────────────────────────────────────────────────────
  { emoji: '🐶', label: 'Dog fed',         cls: 'repeatable', tags: ['home'] },
  { emoji: '',   label: 'Meeting',         cls: 'repeatable', tags: ['work', 'midday', 'wifi_work'] },
  { emoji: '',   label: 'Call',            cls: 'repeatable', tags: ['work', 'wifi_work'] },
  { emoji: '',   label: 'Busy',            cls: 'repeatable', tags: ['generic', 'midday'] },
  { emoji: '',   label: 'On the way',      cls: 'repeatable', tags: ['generic', 'cellular'] },
  { emoji: '',   label: 'Running errands', cls: 'repeatable', tags: ['generic', 'cellular'] },
  { emoji: '',   label: 'On train',        cls: 'repeatable', tags: ['work', 'cellular'] },
  { emoji: '',   label: 'Eating',          cls: 'repeatable', tags: ['generic', 'midday', 'evening'] },
  { emoji: '',   label: 'Arriving',        cls: 'repeatable', tags: ['team', 'cellular'] },
  { emoji: '',   label: 'Arriving soon',   cls: 'repeatable', tags: ['cellular'] },

  // ── Contextual ─────────────────────────────────────────────────────────────
  { emoji: '',   label: 'At desk',         cls: 'contextual', tags: ['work', 'morning', 'wifi_work'] },
  { emoji: '',   label: 'Cooking',         cls: 'contextual', tags: ['home', 'evening'] },
  { emoji: '',   label: 'Ordering food',   cls: 'contextual', tags: ['home', 'midday', 'evening'] },
  { emoji: '🧺', label: 'Laundry running', cls: 'contextual', tags: ['home', 'wifi_home'] },
  { emoji: '',   label: 'Relaxing',        cls: 'contextual', tags: ['home', 'evening'] },
  { emoji: '',   label: 'Warmup',          cls: 'contextual', tags: ['team'] },
  { emoji: '',   label: 'Drills',          cls: 'contextual', tags: ['team'] },
  { emoji: '',   label: 'Scrimmage',       cls: 'contextual', tags: ['team'] },
  { emoji: '',   label: 'Game starting',   cls: 'contextual', tags: ['team'] },
  { emoji: '',   label: 'Practice active', cls: 'contextual', tags: ['team', 'evening'] },
  { emoji: '',   label: 'Wrapping up',     cls: 'contextual', tags: ['team', 'night'] },
  { emoji: '',   label: 'Quiet now',       cls: 'contextual', tags: ['generic', 'night'] },

  // ── Seasonal (lightweight) ─────────────────────────────────────────────────
  { emoji: '', label: 'Firepit',        cls: 'contextual', tags: ['home', 'evening', 'fall'] },
  { emoji: '', label: 'Hot chocolate',  cls: 'contextual', tags: ['home', 'winter'] },
]

// ─── Context detection ────────────────────────────────────────────────────────

function detectSpaceType(name: string): string {
  const n = name.toLowerCase()
  if (/home|house|cabin|apt|flat|condo/.test(n)) return 'home'
  if (/office|work|hq|studio|clinic|lab|desk/.test(n)) return 'work'
  if (/team|practice|league|gym|court|dance/.test(n)) return 'team'
  return 'generic'
}

function detectTimeOfDay(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'midday'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

function isWeekend(): boolean {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

function detectSeason(): string {
  const m = new Date().getMonth()
  if (m === 11) return 'holiday'
  if (m <= 1) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'fall'
}

function detectNetwork(spaceType: string): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const conn = (navigator as any).connection
  if (!conn) return 'unknown'
  const type = conn.type ?? ''
  const eff = conn.effectiveType ?? ''
  if (type === 'cellular' || eff === '2g' || eff === '3g') return 'cellular'
  if (type === 'wifi') return spaceType === 'work' ? 'wifi_work' : 'wifi_home'
  return 'unknown'
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function buildSuggestions(
  spaceName: string,
  events: Event[],
  activeMemberId: string | null,
): SuggestionItem[] {
  const spaceType = detectSpaceType(spaceName)
  const tod = detectTimeOfDay()
  const network = detectNetwork(spaceType)
  const weekend = isWeekend()
  const season = detectSeason()
  const now = Date.now()

  const freq = new Map<string, number>()
  const habit = new Map<string, number>()
  const lastLogged = new Map<string, number>()

  events.slice(0, 40).forEach((e, i) => {
    const key = e.label.toLowerCase()
    const hour = new Date(e.created_at).getHours()
    const habitKey = `${key}__${hour}`

    const decay = i < 5 ? 4 : i < 15 ? 2 : 1
    const own = e.member_id === activeMemberId ? 2 : 1

    freq.set(key, (freq.get(key) ?? 0) + decay * own)
    habit.set(habitKey, (habit.get(habitKey) ?? 0) + 1)

    const t = new Date(e.created_at).getTime()
    const cur = lastLogged.get(key)
    if (cur === undefined || t > cur) lastLogged.set(key, t)
  })

  const hour = new Date().getHours()

  const scored = CANDIDATES.map(c => {
    const key = c.label.toLowerCase()

    if (c.cls === 'time-locked' && !c.windows!.includes(tod)) return null

    let score = 0

    // time
    if (c.cls === 'time-locked') score += 20
    else if (c.tags.includes(tod)) score += 12

    // space
    if (c.tags.includes(spaceType)) score += 8

    // network
    if (c.tags.includes(network)) score += 3

    // weekend bias
    if (weekend && c.tags.includes('work')) score -= 8

    // season
    if (c.tags.includes(season)) score += 4

    // frequency
    score += Math.min(freq.get(key) ?? 0, 8)

    // habit (time-of-day memory)
    const habitKey = `${key}__${hour}`
    score += Math.min(habit.get(habitKey) ?? 0, 6)

    // recency penalty
    const last = lastLogged.get(key)
    if (last !== undefined) {
      const minAgo = (now - last) / 60000
      if (c.cls === 'repeatable') {
        if (minAgo < 30) score -= 20
        else if (minAgo < 120) score -= 10
        else if (minAgo < 360) score -= 5
      } else if (c.cls === 'time-locked') {
        if (minAgo < 60) score -= 15
        else if (minAgo < 180) score -= 8
      }
    }

    return { ...c, score }
  }).filter(Boolean) as (Candidate & { score: number })[]

  scored.sort((a, b) => b.score - a.score)

  const result: SuggestionItem[] = []
  let icons = 0

  for (const c of scored) {
    if (result.length >= 10) break
    const showIcon = !!c.emoji && icons < 2
    result.push({ emoji: showIcon ? c.emoji : '', label: c.label })
    if (showIcon) icons++
  }

  return result
} 
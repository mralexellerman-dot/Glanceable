// ─── State vs Event classification ────────────────────────────────────────────
// classifyEntry(label) → 'future' | 'event' | 'state'
//
// 'future'  — label contains a future time phrase ("in 20m", "at 7") → scheduled item
// 'event'   — looks like an action, transition, or named activity → flows to TODAY
// 'state'   — ongoing condition/mood/presence → CURRENT only, excluded from TODAY
//
// Decision order:
//   1. If parseScheduled matches → 'future'
//   2. Contains explicit time language ("in Xm", "at H", "@ H") → 'event'
//   3. Starts with a transition/action verb → 'event'
//   4. Matches a known event label or preset keyword → 'event'
//   5. Everything else → 'state'

// Known action-start verbs (prefix match, lowercase)
const EVENT_VERBS = [
  'getting', 'wrapping', 'leaving', 'heading', 'starting', 'on the',
  'picking', 'dropping', 'running', 'walking', 'driving', 'flying',
  'cooking', 'ordering', 'making', 'finishing', 'cleaning', 'doing',
  'going', 'coming', 'back', 'arriving',
]

// Known event keywords — any word in the label that signals a discrete activity
const EVENT_KEYWORDS = new Set([
  'coffee', 'lunch', 'dinner', 'breakfast', 'practice', 'meeting',
  'call', 'game', 'workout', 'gym', 'run', 'walk', 'hike', 'ride',
  'class', 'appointment', 'pickup', 'dropoff', 'errand', 'trip',
  'started', 'done', 'finished', 'running', 'arrived', 'back',
  'laundry', 'groceries', 'package', 'mail', 'firepit', 'streaming',
  'podcast', 'recording',
])

// Parse natural-language scheduling phrases.
// Returns { label, starts_at } if matched, null otherwise.
export function parseScheduled(text: string): { label: string; starts_at: string } | null {
  const rel = text.match(/^(.+?)\s+in\s+(\d+)\s*(m(?:in(?:ute)?s?)?|h(?:r?s?|ours?)?)$/i)
  if (rel) {
    const raw      = rel[1].trim()
    const label    = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    const n        = parseInt(rel[2])
    const unitStr  = (rel[3] || 'm').toLowerCase()
    const isHours  = /^h/.test(unitStr)
    const ms       = isHours ? n * 3_600_000 : n * 60_000
    if (n > 0 && ms <= 24 * 3_600_000) {
      return { label, starts_at: new Date(Date.now() + ms).toISOString() }
    }
  }

  const at = text.match(/^(.+?)\s+at\s+(\d{1,2})(?::(\d{2}))?$/i)
  if (at) {
    const raw   = at[1].trim()
    const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    const h     = parseInt(at[2])
    const m     = parseInt(at[3] ?? '0')
    if (h >= 1 && h <= 12 && m >= 0 && m < 60) {
      const now   = new Date()
      const nowMs = now.getTime()
      for (const ch of h === 12 ? [12, 0] : [h, h + 12]) {
        const d = new Date(now)
        d.setHours(ch, m, 0, 0)
        if (d.getTime() > nowMs) return { label, starts_at: d.toISOString() }
      }
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      d.setHours(h, m, 0, 0)
      return { label, starts_at: d.toISOString() }
    }
  }

  return null
}

export function classifyEntry(label: string): 'future' | 'event' | 'state' {
  const raw = label.trim()
  if (!raw) return 'state'

  if (parseScheduled(raw)) return 'future'

  const lower = raw.toLowerCase()

  if (/\bin\s+\d+\s*(?:m(?:in)?|h(?:r?|our)?)/.test(lower)) return 'event'
  if (/\bat\s+\d/.test(lower) || /@\s*\d/.test(lower))      return 'event'
  if (/\d{1,2}:\d{2}/.test(lower))                          return 'event'

  for (const verb of EVENT_VERBS) {
    if (lower === verb || lower.startsWith(verb + ' ')) return 'event'
  }

  const words = lower.split(/\s+/)
  for (const w of words) {
    if (EVENT_KEYWORDS.has(w)) return 'event'
  }

  return 'state'
}

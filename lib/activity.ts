import type { Event } from './types'

/**
 * Build a map of latest recent activity per member_id.
 * Only includes activities within the last 30 minutes.
 * For each member, keeps only the most recent event.
 */
export function buildRecentActivityMap(
  events: Event[],
  now: number = Date.now()
): Map<string, Event> {
  const thirtyMinAgo = now - 30 * 60_000
  const activityMap = new Map<string, Event>()

  for (const event of events) {
    // Skip events without member attribution
    if (!event.member_id) continue

    const eventMs = new Date(event.created_at).getTime()

    // Skip stale events
    if (eventMs < thirtyMinAgo) continue

    const existing = activityMap.get(event.member_id)
    // Keep the most recent (latest timestamp wins)
    if (!existing || eventMs > new Date(existing.created_at).getTime()) {
      activityMap.set(event.member_id, event)
    }
  }

  return activityMap
}

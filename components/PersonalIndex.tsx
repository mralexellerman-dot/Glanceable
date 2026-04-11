'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { classifyEntry } from '@/lib/classify'
import type { Event } from '@/lib/types'

interface PIData {
  often:    string[]
  moments:  string[]
  together: { label: string; count: number }[]
}

function buildPI(events: Event[], activeMemberId: string): PIData | null {
  const now      = Date.now()
  const cutoff7d = now - 7 * 24 * 3_600_000

  const stateEvents = events.filter(e =>
    new Date(e.created_at).getTime() >= cutoff7d &&
    classifyEntry(e.label) === 'state'
  )

  // Frequency count — personal only
  const personalCounts = new Map<string, number>()
  const labelDisplay   = new Map<string, string>()
  for (const e of stateEvents) {
    if (e.member_id !== activeMemberId) continue
    const key = e.label.trim().toLowerCase()
    personalCounts.set(key, (personalCounts.get(key) ?? 0) + 1)
    if (!labelDisplay.has(key)) labelDisplay.set(key, e.label.trim())
  }

  if (personalCounts.size === 0) return null

  const ranked = [...personalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, label: labelDisplay.get(key) ?? key }))

  const often   = ranked.slice(0, 3).map(r => r.label)
  const moments = ranked.slice(3, 6).filter(r => r.count >= 1).map(r => r.label).slice(0, 3)

  // Shared states: 2+ distinct members within same 10-min bucket
  const buckets = new Map<string, Set<string>>()
  for (const e of stateEvents) {
    if (!e.member_id) continue
    const key    = e.label.trim().toLowerCase()
    const bucket = Math.floor(new Date(e.created_at).getTime() / (10 * 60_000))
    const bKey   = `${key}__${bucket}`
    if (!buckets.has(bKey)) buckets.set(bKey, new Set())
    buckets.get(bKey)!.add(e.member_id)
  }
  const sharedCounts = new Map<string, number>()
  for (const [bKey, memberSet] of buckets) {
    if (memberSet.size < 2) continue
    const label = bKey.split('__')[0]
    sharedCounts.set(label, (sharedCounts.get(label) ?? 0) + 1)
  }
  const together = [...sharedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ label: labelDisplay.get(key) ?? key, count }))

  return { often, moments, together }
}

interface Props {
  spaceId:        string
  activeMemberId: string | null
}

export default function PersonalIndex({ spaceId, activeMemberId }: Props) {
  const [pi, setPI] = useState<PIData | null>(null)

  useEffect(() => {
    if (!activeMemberId) return
    const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
    supabase
      .from('events')
      .select('id, member_id, label, created_at, space_id')
      .eq('space_id', spaceId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setPI(buildPI(data as Event[], activeMemberId))
      })
  }, [spaceId, activeMemberId])

  // Hidden entirely when no data — no loading state, no placeholder
  if (!pi || pi.often.length === 0) return null

  const dim  = { color: '#B0ABA4', fontSize: '12px', margin: 0 } as const
  const body = { color: '#3A3530', fontSize: '13px', lineHeight: '1.7', margin: 0 } as const

  return (
    <section className="px-5 py-5">
      <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', color: '#B0ABA4', textTransform: 'uppercase' as const, marginBottom: '14px' }}>
        This week
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div>
          <p style={dim}>You were often in:</p>
          {pi.often.map(l => <p key={l} style={body}>{l}</p>)}
        </div>

        {pi.moments.length > 0 && (
          <div>
            <p style={dim}>There were moments of:</p>
            {pi.moments.map(l => <p key={l} style={body}>{l}</p>)}
          </div>
        )}

        {pi.together.length > 0 && (
          <div>
            <p style={dim}>Together, you were in:</p>
            {pi.together.map(({ label, count }) => (
              <p key={label} style={body}>
                {label}<span style={{ color: '#C4C0B8', marginLeft: '6px' }}>· {count}</span>
              </p>
            ))}
          </div>
        )}

        <p style={{ ...dim, marginTop: '2px' }}>That was your week.</p>

      </div>
    </section>
  )
}

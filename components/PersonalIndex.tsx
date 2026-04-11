'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { classifyEntry } from '@/lib/classify'
import type { Event } from '@/lib/types'

interface PIData {
  often:    string[]   // top 2–3 most frequent states
  moments:  string[]   // 1–3 less frequent states
  together: { label: string; count: number }[]  // shared (multi-member) states
}

function buildPI(events: Event[], activeMemberId: string): PIData {
  const now       = Date.now()
  const cutoff7d  = now - 7 * 24 * 3_600_000

  // Only states (not events/futures) within the last 7 days
  const stateEvents = events.filter(e => {
    if (new Date(e.created_at).getTime() < cutoff7d) return false
    return classifyEntry(e.label) === 'state'
  })

  // Count per normalized label — personal (active member) only
  const personalCounts = new Map<string, number>()
  for (const e of stateEvents) {
    if (e.member_id !== activeMemberId) continue
    const key = e.label.trim().toLowerCase()
    personalCounts.set(key, (personalCounts.get(key) ?? 0) + 1)
  }

  // Sort by frequency descending, keep display-cased label from first occurrence
  const labelDisplay = new Map<string, string>()
  for (const e of stateEvents) {
    if (e.member_id !== activeMemberId) continue
    const key = e.label.trim().toLowerCase()
    if (!labelDisplay.has(key)) labelDisplay.set(key, e.label.trim())
  }

  const ranked = [...personalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count, label: labelDisplay.get(key) ?? key }))

  const often   = ranked.slice(0, 3).map(r => r.label)
  const moments = ranked.slice(3, 6)
    .filter(r => r.count >= 1)
    .map(r => r.label)
    .slice(0, 3)

  // Shared states: labels logged by 2+ distinct members in a 10-min window
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
  onClose:        () => void
}

export default function PersonalIndex({ spaceId, activeMemberId, onClose }: Props) {
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

  if (!activeMemberId) return null

  const T  = { color: '#2A2520', fontSize: '13px', lineHeight: '1.6' } as const
  const DIM = { color: '#9A948E', fontSize: '12px' } as const

  return (
    <div style={{ padding: '20px 20px 24px', borderTop: '1px solid #EDE9E3' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', color: '#B0ABA4', textTransform: 'uppercase' }}>
          This week
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#C4C0B8', fontSize: '16px', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {!pi ? (
        <p style={DIM}>Loading…</p>
      ) : pi.often.length === 0 ? (
        <p style={DIM}>Not enough activity this week yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Often */}
          <div>
            <p style={DIM}>You were often in:</p>
            <div style={{ marginTop: '4px' }}>
              {pi.often.map(l => (
                <p key={l} style={T}>{l}</p>
              ))}
            </div>
          </div>

          {/* Moments */}
          {pi.moments.length > 0 && (
            <div>
              <p style={DIM}>There were moments of:</p>
              <div style={{ marginTop: '4px' }}>
                {pi.moments.map(l => (
                  <p key={l} style={T}>{l}</p>
                ))}
              </div>
            </div>
          )}

          {/* Together */}
          {pi.together.length > 0 && (
            <div>
              <p style={DIM}>Together, you were in:</p>
              <div style={{ marginTop: '4px' }}>
                {pi.together.map(({ label, count }) => (
                  <p key={label} style={T}>
                    {label}
                    <span style={{ color: '#C4C0B8', marginLeft: '6px' }}>· {count}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p style={{ ...DIM, marginTop: '4px' }}>That was your week.</p>

        </div>
      )}
    </div>
  )
}

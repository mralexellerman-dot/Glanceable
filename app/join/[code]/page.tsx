'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'
import { buildRecentActivityMap } from '@/lib/activity'
import type { Space, Event, Member } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strip known emotion modifiers so we never show "Coffee · calm" on the join screen
const EMOTION_WORDS = new Set(['good', 'calm', 'stressed', 'quiet', 'tired'])
function primaryOnly(label: string): string {
  const sep = label.lastIndexOf(' · ')
  if (sep !== -1 && EMOTION_WORDS.has(label.slice(sep + 3).toLowerCase())) {
    return label.slice(0, sep)
  }
  return label
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'landing' | 'naming' | 'not_found'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const code   = (params.code as string).toUpperCase()

  // Data
  const [space,        setSpace]        = useState<Space | null>(null)
  const [members,      setMembers]      = useState<Member[]>([])
  const [inviterName,  setInviterName]  = useState<string>('')
  const [stateLabel,   setStateLabel]   = useState<string>('')

  // Phase
  const [phase,        setPhase]        = useState<Phase>('loading')
  const [memberName,   setMemberName]   = useState('')
  const [joining,      setJoining]      = useState(false)
  const [error,        setError]        = useState('')

  // Duplicate handling (kept inline, minimal)
  const [dupCandidate, setDupCandidate] = useState<Member | null>(null)

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const browserId = getBrowserId()

      const { data: spaceData } = await supabase
        .from('spaces')
        .select('*')
        .eq('invite_code', code)
        .single()

      if (!spaceData) {
        setPhase('not_found')
        return
      }

      // Already a member — go straight in
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('space_id', spaceData.id)
        .eq('browser_id', browserId)
        .single()

      if (existing) {
        router.replace(`/space/${spaceData.id}`)
        return
      }

      setSpace(spaceData)

      const [{ data: membersData }, { data: eventsData }] = await Promise.all([
        supabase.from('members').select('*').eq('space_id', spaceData.id).order('created_at'),
        supabase.from('events').select('*').eq('space_id', spaceData.id)
          .order('created_at', { ascending: false }).limit(50),
      ])

      const allMembers = membersData ?? []
      const allEvents  = eventsData  ?? [] as Event[]
      setMembers(allMembers)

      // Find inviter's active state (30-min window)
      const activityMap  = buildRecentActivityMap(allEvents)
      const inviterMember = allMembers.find(m => activityMap.has(m.id))
      const inviterEvent  = inviterMember ? activityMap.get(inviterMember.id) : null

      if (inviterMember && inviterEvent) {
        setInviterName(inviterMember.display_name)
        setStateLabel(inviterEvent.label)
        setPhase('landing')
      } else if (allMembers.length > 0) {
        // Space exists but no recent activity — still let them join
        setInviterName(allMembers[0].display_name)
        setStateLabel('')
        setPhase('landing')
      } else {
        setPhase('landing')
      }
    }
    load()
  }, [code, router])

  // ─── Join logic ────────────────────────────────────────────────────────────

  async function doJoin(name: string, useLabel: string) {
    if (!space) return
    setJoining(true)
    setError('')
    const browserId = getBrowserId()

    const { data: existing } = await supabase
      .from('members').select('id')
      .eq('space_id', space.id).eq('browser_id', browserId).single()
    if (existing) { router.push(`/space/${space.id}`); return }

    // Duplicate name guard
    const norm = name.trim().toLowerCase()
    const dup  = members.find(m => m.display_name.trim().toLowerCase() === norm)
    if (dup) {
      setDupCandidate(dup)
      setJoining(false)
      return
    }

    // presence_state only accepts: 'home' | 'away' | 'dnd' | 'tbd'
    // useLabel is a free-form event label (e.g. "Coffee") — never store it here
    const VALID_PRESENCE = new Set(['home', 'away', 'dnd', 'tbd'])
    const safePresence   = VALID_PRESENCE.has(useLabel?.toLowerCase()) ? useLabel.toLowerCase() : 'tbd'
    console.log('[join] inserting presence_state:', safePresence, '(raw useLabel:', useLabel, ')')

    const { data: inserted, error: err } = await supabase.from('members').insert({
      space_id:       space.id,
      browser_id:     browserId,
      display_name:   name.trim(),
      presence_state: safePresence,
    }).select('id').single()

    if (err) {
      setError(err.message)
      setJoining(false)
      return
    }

    try {
      localStorage.setItem('last_space_id', space.id)
      sessionStorage.setItem('dw_join_handoff', JSON.stringify({ spaceId: space.id, memberId: inserted.id }))
    } catch {}
    router.replace(`/space/${space.id}`)
  }

  async function handleRejoin() {
    if (!space || !dupCandidate) return
    setJoining(true)
    const browserId = getBrowserId()
    await supabase.from('members').update({ browser_id: browserId }).eq('id', dupCandidate.id)
    try {
      localStorage.setItem('last_space_id', space.id)
      sessionStorage.setItem('dw_join_handoff', JSON.stringify({ spaceId: space.id, memberId: dupCandidate.id }))
    } catch {}
    router.replace(`/space/${space.id}`)
  }

  // ─── Shared styles ─────────────────────────────────────────────────────────

  const PAGE: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    background: '#FAFAF8',
  }

  const WRAP: React.CSSProperties = {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return <div style={PAGE}><span style={{ color: '#C4C0B8', fontSize: '14px' }}>…</span></div>
  }

  // ─── Not found ─────────────────────────────────────────────────────────────

  if (phase === 'not_found' || !space) {
    return (
      <div style={PAGE}>
        <p style={{ color: '#9CA3AF', fontSize: '14px' }}>This link is no longer active.</p>
      </div>
    )
  }

  // ─── Landing + Naming ──────────────────────────────────────────────────────

  const primaryLabel = primaryOnly(stateLabel)

  return (
    <div style={PAGE}>
      <div style={WRAP}>

        {/* Space name */}
        {space?.name && (
          <p style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#B0ABA4', margin: 0 }}>
            {space.name}
          </p>
        )}

        {/* Inviter + state */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {inviterName && (
            <p style={{ fontSize: '15px', color: '#9A948E', margin: 0 }}>{inviterName}</p>
          )}
          {primaryLabel && (
            <p style={{ fontSize: '22px', fontWeight: 600, color: '#1C1814', margin: 0, letterSpacing: '-0.01em' }}>
              {primaryLabel}
            </p>
          )}
          {primaryLabel && phase === 'landing' && (
            <p style={{ fontSize: '13px', color: '#B0ABA4', margin: 0, marginTop: '2px' }}>Right now?</p>
          )}
        </div>

        {/* Primary action — tappable state chip */}
        {primaryLabel && phase === 'landing' && (
          <button
            onClick={() => setPhase('naming')}
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              alignSelf:    'flex-start',
              padding:      '10px 22px',
              borderRadius: '999px',
              background:   '#1A1A18',
              color:        '#FFFFFF',
              fontSize:     '15px',
              fontWeight:   500,
              border:       'none',
              cursor:       'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {primaryLabel}
          </button>
        )}

        {/* Naming phase — appears after tapping the chip */}
        {(phase === 'naming' || (!stateLabel && phase === 'landing')) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {dupCandidate ? (
              <>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                  <strong>{dupCandidate.display_name}</strong> already exists here. That you?
                </p>
                <button
                  onClick={handleRejoin}
                  disabled={joining}
                  style={{
                    padding: '11px 0', borderRadius: '12px',
                    background: '#1A1A18', color: '#FFFFFF',
                    fontSize: '14px', fontWeight: 500, border: 'none',
                    cursor: joining ? 'default' : 'pointer', opacity: joining ? 0.5 : 1,
                  }}
                >
                  {joining ? 'Joining…' : `Yes, that's me`}
                </button>
                <button
                  onClick={() => setDupCandidate(null)}
                  style={{
                    padding: '11px 0', borderRadius: '12px',
                    background: 'none', color: '#9A948E',
                    fontSize: '13px', border: '1px solid #E5E2DE', cursor: 'pointer',
                  }}
                >
                  Different person
                </button>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  type="text"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && memberName.trim() && doJoin(memberName, primaryLabel)}
                  placeholder="Your name"
                  style={{
                    fontSize: '16px', color: '#1C1814',
                    background: '#F4F1EC', border: 'none',
                    borderRadius: '12px', padding: '12px 16px',
                    outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                {error && <p style={{ fontSize: '12px', color: '#EF4444', margin: 0 }}>{error}</p>}
                <button
                  onClick={() => doJoin(memberName, primaryLabel)}
                  disabled={!memberName.trim() || joining}
                  style={{
                    padding: '12px 0', borderRadius: '12px',
                    background: '#1A1A18', color: '#FFFFFF',
                    fontSize: '15px', fontWeight: 500, border: 'none',
                    cursor: memberName.trim() && !joining ? 'pointer' : 'default',
                    opacity: memberName.trim() && !joining ? 1 : 0.35,
                    transition: 'opacity 150ms',
                  }}
                >
                  {joining ? 'Joining…' : primaryLabel ? `Join · ${primaryLabel}` : 'Join'}
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

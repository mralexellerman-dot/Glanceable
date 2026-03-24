'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countdown(dateStr: string): string {
  const min = Math.round((new Date(dateStr).getTime() - Date.now()) / 60_000)
  if (min <= 0) return 'now'
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  label: string
  starts_at: string
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export default function WidgetPage() {
  const { spaceId } = useParams<{ spaceId: string }>()

  const [spaceName,  setSpaceName]  = useState('')
  const [memberId,   setMemberId]   = useState<string | null>(null)
  const [presence,   setPresence]   = useState('tbd')
  const [upcoming,   setUpcoming]   = useState<UpcomingItem | null>(null)
  const [confirmed,  setConfirmed]  = useState<string | null>(null)
  const [showToken,  setShowToken]  = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [loading,    setLoading]    = useState(true)

  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function init() {
      const browserId = getBrowserId()
      const [memberRes, spaceRes, upcomingRes] = await Promise.all([
        supabase
          .from('members')
          .select('id, presence_state')
          .eq('space_id', spaceId)
          .eq('browser_id', browserId)
          .single(),
        supabase
          .from('spaces')
          .select('name')
          .eq('id', spaceId)
          .single(),
        supabase
          .from('upcoming')
          .select('label, starts_at')
          .eq('space_id', spaceId)
          .gte('starts_at', new Date().toISOString())
          .order('starts_at')
          .limit(1),
      ])
      if (memberRes.data) { setMemberId(memberRes.data.id); setPresence(memberRes.data.presence_state) }
      if (spaceRes.data)   setSpaceName(spaceRes.data.name)
      if (upcomingRes.data?.[0]) setUpcoming(upcomingRes.data[0])
      setLoading(false)
    }
    init()
  }, [spaceId])

  async function tap(state: string, label: string) {
    if (!memberId) return
    setPresence(state)
    setConfirmed(label)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmed(null), 1500)
    await supabase
      .from('members')
      .update({ presence_state: state, presence_updated_at: new Date().toISOString() })
      .eq('id', memberId)
  }

  async function copyMemberId() {
    if (!memberId) return
    await navigator.clipboard.writeText(memberId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={styles.page}>
      <span style={{ color: '#CCC', fontSize: '13px' }}>…</span>
    </div>
  )

  // ── Not a member ───────────────────────────────────────────────────────────

  if (!memberId) return (
    <div style={{ ...styles.page, flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '14px', color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
        Not a member of this space.<br />Open the app first.
      </p>
      <a href={`/space/${spaceId}`} style={{ fontSize: '13px', color: '#1A1A18', textDecoration: 'underline' }}>
        Open space
      </a>
    </div>
  )

  // ── Widget ─────────────────────────────────────────────────────────────────

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div style={styles.page}>
      <div style={styles.content}>

        {/* ── Widget card ─────────────────────────────────────────────────── */}
        <div style={styles.card}>

          {/* Header row */}
          <div style={styles.cardHeader}>
            <span style={styles.brandLabel}>Glanceable</span>
            <span style={styles.spaceLabel}>{spaceName}</span>
          </div>

          {/* Tap in label */}
          <p style={styles.sectionLabel}>Tap in</p>

          {/* Buttons / confirmation */}
          {confirmed ? (
            <div style={styles.confirmation}>✓ {confirmed}</div>
          ) : (
            <div style={styles.buttonRow}>
              {(['home', 'away'] as const).map(state => {
                const label    = state === 'home' ? 'Home' : 'Away'
                const isActive = presence === state
                return (
                  <button
                    key={state}
                    onClick={() => tap(state, label)}
                    style={{
                      ...styles.presenceBtn,
                      background: isActive ? '#1A1A18' : '#F4F1EC',
                      color:      isActive ? '#FFF'    : '#3A3630',
                      fontWeight: isActive ? 600       : 400,
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Upcoming */}
          {upcoming && (
            <div style={styles.upcomingRow}>
              <span style={{ fontSize: '13px', color: '#5A554E' }}>
                {upcoming.label}
              </span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                {countdown(upcoming.starts_at)}
              </span>
            </div>
          )}
        </div>

        {/* Full board link */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <a
            href={`/space/${spaceId}`}
            style={{ fontSize: '12px', color: '#C4C0B8', textDecoration: 'none' }}
          >
            Full board →
          </a>
        </div>

        {/* ── iOS Shortcut setup ──────────────────────────────────────────── */}
        <div style={{ marginTop: '36px' }}>
          <button
            onClick={() => setShowToken(v => !v)}
            style={styles.tokenToggle}
          >
            {showToken ? 'Hide shortcut setup' : 'Set up iOS Shortcut ›'}
          </button>

          {showToken && (
            <div style={styles.tokenCard}>
              <p style={styles.tokenIntro}>
                Make a Shortcut in the iOS Shortcuts app that sends a POST request.
                Add it to your lock screen or Home Screen for one-tap updates.
              </p>

              <TokenField label="URL" value={`${origin}/api/presence`} />
              <TokenField label="Body — set Home" value={`{"member_id":"${memberId}","state":"home"}`} />
              <TokenField label="Body — set Away" value={`{"member_id":"${memberId}","state":"away"}`} />

              <button onClick={copyMemberId} style={styles.copyBtn}>
                {copied ? '✓ Copied' : 'Copy member ID'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function TokenField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <p style={{ fontSize: '10px', color: '#A8A49C', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <code style={{ fontSize: '11px', color: '#4A453F', wordBreak: 'break-all', display: 'block', lineHeight: 1.5 }}>
        {value}
      </code>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight:      '100dvh',
    background:     '#FAFAF8',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        'env(safe-area-inset-top, 48px) 24px env(safe-area-inset-bottom, 32px)',
  } as React.CSSProperties,

  content: {
    width:    '100%',
    maxWidth: '320px',
  } as React.CSSProperties,

  card: {
    background:   '#FFF',
    borderRadius: '20px',
    padding:      '20px 20px 18px',
    boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
  } as React.CSSProperties,

  cardHeader: {
    display:        'flex',
    alignItems:     'baseline',
    justifyContent: 'space-between',
    marginBottom:   '14px',
  } as React.CSSProperties,

  brandLabel: {
    fontSize:      '11px',
    fontWeight:    600,
    letterSpacing: '0.06em',
    color:         '#A8A49C',
    textTransform: 'uppercase',
  } as React.CSSProperties,

  spaceLabel: {
    fontSize: '12px',
    color:    '#C4C0B8',
  } as React.CSSProperties,

  sectionLabel: {
    fontSize:     '13px',
    color:        '#6E6A64',
    marginBottom: '10px',
  } as React.CSSProperties,

  buttonRow: {
    display: 'flex',
    gap:     '8px',
  } as React.CSSProperties,

  presenceBtn: {
    flex:         1,
    padding:      '13px',
    borderRadius: '12px',
    border:       'none',
    cursor:       'pointer',
    fontSize:     '15px',
    transition:   'background 0.1s',
    WebkitTapHighlightColor: 'transparent',
  } as React.CSSProperties,

  confirmation: {
    padding:    '10px 0',
    fontSize:   '16px',
    fontWeight: 500,
    color:      '#1A1A18',
  } as React.CSSProperties,

  upcomingRow: {
    display:         'flex',
    alignItems:      'baseline',
    justifyContent:  'space-between',
    marginTop:       '14px',
    paddingTop:      '12px',
    borderTop:       '1px solid #F0EDE8',
  } as React.CSSProperties,

  tokenToggle: {
    fontSize:   '12px',
    color:      '#C4C0B8',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    padding:    0,
  } as React.CSSProperties,

  tokenCard: {
    marginTop:    '12px',
    background:   '#F4F1EC',
    borderRadius: '12px',
    padding:      '14px 16px',
  } as React.CSSProperties,

  tokenIntro: {
    fontSize:     '12px',
    color:        '#6E6A64',
    marginBottom: '12px',
    lineHeight:   1.55,
  } as React.CSSProperties,

  copyBtn: {
    marginTop:      '4px',
    fontSize:       '11px',
    color:          '#1A1A18',
    background:     'none',
    border:         'none',
    cursor:         'pointer',
    padding:        0,
    textDecoration: 'underline',
  } as React.CSSProperties,
} as const

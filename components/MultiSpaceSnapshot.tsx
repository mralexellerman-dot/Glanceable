'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type SnapshotSpace = {
  id: string
  name: string
  subtitle?: string
}

interface MultiSpaceSnapshotProps {
  spaces: SnapshotSpace[]
  onCreate?: () => void
}

function splitSubtitle(subtitle?: string): { who: string | null; state: string | null } {
  if (!subtitle) return { who: null, state: null }

  const parts = subtitle.split(' · ')
  if (parts.length >= 2) {
    return {
      who: parts[0] || null,
      state: parts.slice(1).join(' · ') || null,
    }
  }

  return {
    who: null,
    state: subtitle,
  }
}

export default function MultiSpaceSnapshot({
  spaces,
  onCreate,
}: MultiSpaceSnapshotProps) {
  const router = useRouter()
  const [hiddenIds, setHiddenIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dw_hidden_spaces') || '[]')
      setHiddenIds(Array.isArray(stored) ? stored : [])
    } catch {
      setHiddenIds([])
    }
  }, [])

  function hideSpace(spaceId: string) {
    const next = [...new Set([...hiddenIds, spaceId])]
    setHiddenIds(next)
    try {
      localStorage.setItem('dw_hidden_spaces', JSON.stringify(next))
    } catch {}
  }

  const visibleSpaces = spaces.filter(space => !hiddenIds.includes(space.id))

  const PAGE: React.CSSProperties = {
    minHeight: '100dvh',
    background: '#FAFAF8',
    padding: '32px 20px 44px',
    display: 'flex',
    justifyContent: 'center',
  }

  const WRAP: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  }

  const TITLE: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: '#1C1814',
    margin: 0,
  }

  const SUB: React.CSSProperties = {
    fontSize: '14px',
    color: '#9A948E',
    margin: '4px 0 0 0',
    lineHeight: 1.4,
  }

  const LIST: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  }

  const CARD: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    background: '#F4F1EC',
    border: '1px solid #ECE6DE',
    borderRadius: '20px',
    padding: '16px 16px 15px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 1px 2px rgba(28,24,20,0.03)',
    transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
    position: 'relative',
  }

  const HIDE_BTN: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    fontSize: '12px',
    color: '#B0ABA4',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  }

  const NAME: React.CSSProperties = {
    fontSize: '17px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: '#1C1814',
    margin: 0,
    lineHeight: 1.2,
    paddingRight: '36px',
  }

  const META: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minHeight: '34px',
  }

  const WHO: React.CSSProperties = {
    fontSize: '13px',
    color: '#A29B93',
    margin: 0,
    lineHeight: 1.3,
  }

  const STATE: React.CSSProperties = {
    fontSize: '14px',
    color: '#4A453F',
    margin: 0,
    lineHeight: 1.35,
  }

  const EMPTY: React.CSSProperties = {
    fontSize: '14px',
    color: '#B7B0A8',
    margin: 0,
    lineHeight: 1.35,
    fontStyle: 'italic',
  }

  const EMPTY_LIST: React.CSSProperties = {
    fontSize: '14px',
    color: '#B7B0A8',
    margin: 0,
    lineHeight: 1.4,
    fontStyle: 'italic',
    padding: '8px 2px 0',
  }

  const CREATE_BTN: React.CSSProperties = {
    marginTop: '8px',
    padding: '14px 16px',
    borderRadius: '999px',
    background: '#1A1A18',
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    letterSpacing: '-0.01em',
  }

  return (
    <div style={PAGE}>
      <div style={WRAP}>
        <div style={{ marginBottom: '4px' }}>
          <h1 style={TITLE}>Your spaces</h1>
          <p style={SUB}>Choose a place to enter.</p>
        </div>

        <div style={LIST}>
          {visibleSpaces.length === 0 ? (
            <p style={EMPTY_LIST}>No visible spaces.</p>
          ) : (
            visibleSpaces.map(space => {
              const { who, state } = splitSubtitle(space.subtitle)

              return (
                <div
                  key={space.id}
                  onClick={() => router.push(`/space/${space.id}`)}
                  style={CARD}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#F7F3ED'
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(28,24,20,0.05)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#F4F1EC'
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(28,24,20,0.03)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      hideSpace(space.id)
                    }}
                    style={HIDE_BTN}
                  >
                    hide
                  </button>

                  <p style={NAME}>{space.name}</p>

                  <div style={META}>
                    {who ? <p style={WHO}>{who}</p> : null}
                    {state ? (
                      <p style={STATE}>{state}</p>
                    ) : (
                      <p style={EMPTY}>Tap to begin</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <button
          onClick={() => {
            if (onCreate) onCreate()
            else router.push('/create')
          }}
          style={CREATE_BTN}
        >
          + Create new space
        </button>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'

type Step = 'start' | 'name' | 'welcome'
type InviteState = 'idle' | 'copied'

export default function CreateSpace() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('start')
  const [spaceName, setSpaceName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newSpaceId, setNewSpaceId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteState, setInviteState] = useState<InviteState>('idle')

  function getInviteUrl() {
    if (!inviteCode || typeof window === 'undefined') return ''
    return `${window.location.origin}/join/${inviteCode}`
  }

  async function handleCopyInvite() {
    const url = getInviteUrl()
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setInviteState('copied')
      setTimeout(() => setInviteState('idle'), 1800)
    } catch {}
  }

  async function handleShareInvite() {
    const url = getInviteUrl()
    if (!url) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my space on Glanceable',
          text: 'Join my space on Glanceable.',
          url,
        })
      } catch {}
    } else {
      handleCopyInvite()
    }
  }

  async function handleCreate() {
    if (!spaceName.trim() || !memberName.trim()) return

    setLoading(true)
    setError('')

    try {
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({ name: spaceName.trim() })
        .select()
        .single()

      if (spaceError) throw spaceError

      const { error: memberError } = await supabase
        .from('members')
        .insert({
          space_id: space.id,
          display_name: memberName.trim(),
          presence_state: 'tbd',
          browser_id: getBrowserId(),
        })
        .select()

      if (memberError) throw memberError

      try {
        localStorage.setItem('last_space_id', space.id)
      } catch {}

      setNewSpaceId(space.id)
      setInviteCode(space.invite_code ?? '')
      setStep('welcome')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function handleJoinSubmit() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    router.push(`/join/${code}`)
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-[440px] space-y-6">
        {step === 'start' && (
          <>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Glanceable
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Co-regulate without noise.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep('name')}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white"
                style={{ background: '#1A1A18', border: 'none', cursor: 'pointer' }}
              >
                Create a space
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Have an invite?
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoinSubmit()}
                    placeholder="Enter code"
                    maxLength={8}
                    className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      letterSpacing: '0.08em',
                    }}
                  />

                  <button
                    onClick={handleJoinSubmit}
                    disabled={!joinCode.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                      background: joinCode.trim() ? '#1A1A18' : '#F4F1EC',
                      color: joinCode.trim() ? '#FFFFFF' : '#B0ABA4',
                      border: 'none',
                      cursor: joinCode.trim() ? 'pointer' : 'default',
                    }}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <button
              onClick={() => setStep('start')}
              className="text-sm"
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← Back
            </button>

            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Name your space
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                A space is shared. Glanceable works best with someone else in it.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                placeholder="Home, The Cabin, Studio 4B…"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
                autoFocus
              />

              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
                onKeyDown={e =>
                  e.key === 'Enter' &&
                  spaceName.trim() &&
                  memberName.trim() &&
                  handleCreate()
                }
              />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                onClick={handleCreate}
                disabled={!spaceName.trim() || !memberName.trim() || loading}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                {loading ? 'Creating…' : 'Create space'}
              </button>
            </div>
          </>
        )}

        {step === 'welcome' && newSpaceId && (
          <>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Your space is ready.
              </h1>

              <p className="mt-4 text-base leading-loose" style={{ color: 'var(--text-secondary)' }}>
                Glanceable works best with someone else in it.
              </p>

              <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                Start by tapping in yourself.
                <br />
                When the other person joins, they can glance and see your state.
                <br />
                They can tap into your moment.
                <br />
                You can do the same for them.
              </p>

              <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                That’s when it starts to feel alive.
              </p>
            </div>

            {inviteCode && (
              <div
                className="rounded-2xl p-4 space-y-3 mt-6"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Invite one person.
                </h2>

                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Someone you already think about calling.
                </p>

                <div
                  className="text-sm break-all px-3 py-2 rounded-lg"
                  style={{
                    background: '#F4F1EC',
                    color: '#1A1A18',
                  }}
                >
                  {getInviteUrl()}
                </div>

                <button
                  onClick={handleShareInvite}
                  className="w-full py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: '#1A1A18',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Send to…
                </button>

                <button
                  onClick={handleCopyInvite}
                  className="w-full py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: '#F4F1EC',
                    color: '#1A1A18',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {inviteState === 'copied' ? 'Copied' : 'Copy invite link'}
                </button>

                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  They don’t need to download anything.
                </p>
              </div>
            )}

            <div className="space-y-2 mt-6">
              <button
                onClick={() => router.push(`/space/${newSpaceId}`)}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white active:opacity-80"
                style={{
                  background: '#1A1A18',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Open my space
              </button>

              <button
                onClick={() => router.push('/')}
                className="w-full py-3 text-sm"
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Back to home
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
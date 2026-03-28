'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { getBrowserId } from '@/lib/memberships'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpaceType = 'Home' | 'Team' | 'Work' | 'Friends' | 'Custom'
type Step = 'type' | 'name' | 'welcome'

const TYPE_PLACEHOLDERS: Record<SpaceType, string> = {
  Home:    'Maple House, The Cabin, Beach House…',
  Team:    'Volleyball Team, Soccer Squad, The Practice…',
  Work:    'Studio 4B, HQ, The Office…',
  Friends: 'The Crew, Weekend House, Lake Place…',
  Custom:  'Name this space…',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateSpace() {
  const router = useRouter()

  const [step,       setStep]       = useState<Step>('type')
  const [spaceType,  setSpaceType]  = useState<SpaceType | null>(null)
  const [spaceName,  setSpaceName]  = useState('')
  const [memberName, setMemberName] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [newSpaceId, setNewSpaceId] = useState<string | null>(null)

  async function handleCreate() {
    if (!spaceName.trim() || !memberName.trim()) return
    setLoading(true)
    setError('')

    try {
      const spacePayload = { name: spaceName.trim() }
      console.log('[create] space insert payload:', spacePayload)

      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert(spacePayload)
        .select()
        .single()

      console.log('[create] space insert result:', { data: space, error: spaceError })

      if (spaceError) {
        console.error('[create] space insert failed:', spaceError)
        throw spaceError
      }

      const memberPayload = {
        space_id:       space.id,
        display_name:   memberName.trim(),
        presence_state: 'tbd',
        browser_id:     getBrowserId(),
      }

      console.log('[create] member insert payload:', memberPayload)

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .insert(memberPayload)
        .select()

      console.log('[create] member insert result:', { data: memberData, error: memberError })

      if (memberError) {
        console.error('[create] member insert failed:', memberError)
        throw memberError
      }

      setNewSpaceId(space.id)
      setStep('welcome')
    } catch (err) {
      console.error('[create] handleCreate error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-[420px] space-y-6">

        {/* ── Screen 1: What is this space for? ────────────────────────────── */}
        {step === 'type' && (
          <>
            <Link href="/" className="inline-block text-sm" style={{ color: 'var(--text-muted)' }}>
              ← Back
            </Link>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
              What is this space for?
            </h1>
            <div className="flex flex-wrap gap-2">
              {(['Home', 'Team', 'Work', 'Friends', 'Custom'] as SpaceType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setSpaceType(t); setStep('name') }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium active:opacity-70"
                  style={{ background: '#F4F1EC', color: '#3A3630', border: 'none', cursor: 'pointer' }}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Tap one to get started. You can add more later.
            </p>
          </>
        )}

        {/* ── Screen 2: Name your space ─────────────────────────────────────── */}
        {step === 'name' && (
          <>
            <button
              onClick={() => setStep('type')}
              className="text-sm"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Name your space
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Invite someone (optional)
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                placeholder={spaceType ? TYPE_PLACEHOLDERS[spaceType] : 'Name this space…'}
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                autoFocus
              />
              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="Your name (Mom, Dad, Sam…)"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                onKeyDown={e => e.key === 'Enter' && spaceName.trim() && memberName.trim() && handleCreate()}
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Spaces work best with others.
              </p>
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

        {/* ── Screen 3: Join the present. ───────────────────────────────────── */}
        {step === 'welcome' && newSpaceId && (
          <>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Join the present.
              </h1>
              <p className="mt-4 text-base leading-loose" style={{ color: 'var(--text-secondary)' }}>
                Everyone taps in.<br />
                You glance.<br />
                That's it.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/space/${newSpaceId}`)}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white active:opacity-80"
                style={{ background: '#1A1A18', border: 'none', cursor: 'pointer' }}
              >
                Open my space
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 text-sm"
                style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
              >
                Keep demo spaces
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  )
}

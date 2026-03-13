'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function CreateSpace() {
  const router = useRouter()
  const [step, setStep] = useState<'space' | 'member'>('space')
  const [spaceName, setSpaceName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert({ space_id: space.id, display_name: memberName.trim() })
        .select()
        .single()

      if (memberError) throw memberError

      localStorage.setItem('dw_space_id', space.id)
      localStorage.setItem('dw_member_id', member.id)
      router.push(`/space/${space.id}`)
    } catch {
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
        <Link
          href="/"
          className="inline-block text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back
        </Link>

        {step === 'space' ? (
          <>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Name your space
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                What do you call the place you share?
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                placeholder="Maple House, Studio 4B, Beach Cabin…"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && spaceName.trim() && setStep('member')}
              />
              <button
                onClick={() => spaceName.trim() && setStep('member')}
                disabled={!spaceName.trim()}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <button
                onClick={() => setStep('space')}
                className="text-sm mb-4 block"
                style={{ color: 'var(--text-muted)' }}
              >
                ← Back
              </button>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                What's your name?
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                How others will see you in {spaceName}.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="Mom, Dad, Sam, Felix…"
                className="w-full px-4 py-3 rounded-xl text-base outline-none"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && memberName.trim() && handleCreate()}
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <button
                onClick={handleCreate}
                disabled={!memberName.trim() || loading}
                className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-40 active:opacity-80"
                style={{ background: '#1A1A18' }}
              >
                {loading ? 'Creating…' : 'Create space'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

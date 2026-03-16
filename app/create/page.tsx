'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getBrowserId } from '@/lib/memberships'
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
      const browserId = getBrowserId()

      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .insert({ name: spaceName.trim() })
        .select()
        .single()

      if (spaceError) throw spaceError

      const { data: member, error: memberError } = await supabase
        .from('members')
        .insert({
          space_id: space.id,
          browser_id: browserId,
          display_name: memberName.trim(),
          presence_state: 'home',
          role: 'owner',
        })
        .select()
        .single()

      if (memberError) throw memberError

      const now = Date.now()
      const min = (n: number) => new Date(now - n * 60_000).toISOString()

      // Seed ghost demo members so reactions feel named and the space feels shared
      const { data: ghostMembers } = await supabase.from('members').insert([
        { space_id: space.id, browser_id: 'demo-alex',  display_name: 'Alex',  presence_state: 'home', role: 'member' },
        { space_id: space.id, browser_id: 'demo-jamie', display_name: 'Jamie', presence_state: 'away', role: 'member' },
        { space_id: space.id, browser_id: 'demo-sam',   display_name: 'Sam',   presence_state: 'home', role: 'member' },
        { space_id: space.id, browser_id: 'demo-mom',   display_name: 'Mom',   presence_state: 'away', role: 'member' },
      ]).select()

      // Seed demo events
      // CURRENT (<2h):  Firepit 20m, Dinner launch 60m, Laundry running 119m
      // TODAY (≥2h):    Amazon retrieved 4h, Dog fed 5h, Cat spotted 6h
      // EARLIER:        Lawn mowed 3 days, HVAC serviced 3d+3h
      const { data: seededEvents } = await supabase.from('events').insert([
        { space_id: space.id, member_id: member.id, emoji: '🔥', label: 'Firepit',          created_at: min(20)   },
        { space_id: space.id, member_id: member.id, emoji: '🍝', label: 'Dinner launch',    created_at: min(60)   },
        { space_id: space.id, member_id: member.id, emoji: '🧺', label: 'Laundry running',  created_at: min(119)  },
        { space_id: space.id, member_id: member.id, emoji: '📦', label: 'Amazon retrieved', created_at: min(240)  },
        { space_id: space.id, member_id: member.id, emoji: '🐶', label: 'Dog fed',          created_at: min(300)  },
        { space_id: space.id, member_id: member.id, emoji: '🐈', label: 'Cat spotted',      created_at: min(360)  },
        { space_id: space.id, member_id: member.id, emoji: '🌱', label: 'Lawn mowed',       created_at: min(4320) },
        { space_id: space.id, member_id: member.id, emoji: '🔧', label: 'HVAC serviced',    created_at: min(4500) },
      ]).select()

      // Seed demo reactions
      if (seededEvents && ghostMembers) {
        const firepit = seededEvents.find(e => e.label === 'Firepit')
        const dinner  = seededEvents.find(e => e.label === 'Dinner launch')
        const amazon  = seededEvents.find(e => e.label === 'Amazon retrieved')
        const dog     = seededEvents.find(e => e.label === 'Dog fed')
        const cat     = seededEvents.find(e => e.label === 'Cat spotted')

        const alex  = ghostMembers.find(m => m.display_name === 'Alex')
        const jamie = ghostMembers.find(m => m.display_name === 'Jamie')
        const sam   = ghostMembers.find(m => m.display_name === 'Sam')
        const mom   = ghostMembers.find(m => m.display_name === 'Mom')

        const seeds = [
          // Firepit: 👍 Alex  ❤️ Jamie
          ...(firepit && alex  ? [{ event_id: firepit.id, member_id: alex.id,  emoji: '👍' }] : []),
          ...(firepit && jamie ? [{ event_id: firepit.id, member_id: jamie.id, emoji: '❤️' }] : []),
          // Dinner launch: 👀 Sam
          ...(dinner && sam   ? [{ event_id: dinner.id,  member_id: sam.id,   emoji: '👀' }] : []),
          // Amazon: 👍 Mom
          ...(amazon && mom   ? [{ event_id: amazon.id,  member_id: mom.id,   emoji: '👍' }] : []),
          // Dog fed: 🐾 anonymous
          ...(dog ? [{ event_id: dog.id, member_id: null, emoji: '🐾' }] : []),
          // Cat spotted: 🐾 anonymous
          ...(cat ? [{ event_id: cat.id, member_id: null, emoji: '🐾' }] : []),
        ]
        if (seeds.length) await supabase.from('reactions').insert(seeds)
      }

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
        <Link href="/" className="inline-block text-sm" style={{ color: 'var(--text-muted)' }}>
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
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
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
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && memberName.trim() && handleCreate()}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
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

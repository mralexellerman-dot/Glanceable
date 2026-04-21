'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserMemberships, getTrackedSpaceIds } from '@/lib/memberships'
import MultiSpaceSnapshot from '@/components/MultiSpaceSnapshot'

type Phase = 'checking' | 'landing' | 'spaces'

type SpaceRow = {
  id: string
  name: string
  subtitle: string | undefined
}

export default function HomePage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('checking')
  const [spaces, setSpaces] = useState<SpaceRow[]>([])

  useEffect(() => {
    async function run() {
      const memberships = await getUserMemberships()

      // Case 1 — memberships exist
      if (memberships.length > 0) {
        if (memberships.length === 1) {
          router.replace(`/space/${memberships[0].space_id}`)
          return
        }

        const spaceIds = memberships.map(m => m.space_id)

        const { data: spacesData } = await supabase
          .from('spaces')
          .select('id, name')
          .in('id', spaceIds)

        if (!spacesData) {
          setPhase('landing')
          return
        }

        const rows = spacesData.map(s => ({
          id: s.id,
          name: s.name,
          subtitle: undefined,
        }))

        setSpaces(rows)
        setPhase('spaces')
        return
      }

      // Case 2 — fallback to tracked spaces
      const trackedIds = getTrackedSpaceIds()

      if (trackedIds.length === 0) {
        setPhase('landing')
        return
      }

      const { data: trackedSpaces } = await supabase
        .from('spaces')
        .select('id, name')
        .in('id', trackedIds)

      if (!trackedSpaces || trackedSpaces.length === 0) {
        setPhase('landing')
        return
      }

      if (trackedSpaces.length === 1) {
        router.replace(`/space/${trackedSpaces[0].id}`)
        return
      }

      const orderedTracked = trackedIds
        .map(id => trackedSpaces.find(s => s.id === id))
        .filter(Boolean)
        .map(space => ({
          id: space!.id,
          name: space!.name,
          subtitle: undefined,
        }))

      setSpaces(orderedTracked)
      setPhase('spaces')
    }

    run()
  }, [router])

  if (phase === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        …
      </div>
    )
  }

  if (phase === 'spaces') {
    return <MultiSpaceSnapshot spaces={spaces} />
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-2xl px-6 py-14">
        <div className="mb-12 text-left text-[18px] leading-8 text-neutral-900">
          <p>Sometimes you want to call.</p>
          <p>You just do not know if now is a good time.</p>

          <p className="mt-6">
            Maybe you are across town.
            <br />
            Maybe one of you is still at work.
            <br />
            Maybe one of you is driving home.
            <br />
            Maybe one of you is winding down.
          </p>

          <p className="mt-6">
            So you wait.
            <br />
            Or text.
            <br />
            Or guess.
          </p>

          <p className="mt-6">With Glanceable, you just look.</p>

          <p className="mt-6 font-medium">Dinner · calm</p>

          <p className="mt-6">
            Now you know.
            <br />
            Now is a good time.
          </p>
        </div>

        <div className="text-left border-t border-neutral-200 pt-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Glanceable</h1>

          <p className="text-gray-700 text-lg leading-8 mb-6">
            Know when it’s a good time to connect — without asking.
          </p>

          <p className="text-gray-600 leading-7 mb-8 max-w-xl">
            Glanceable is ambient presence for couples first — and then families
            and small groups. Tap what you’re in. The people in your space see it.
            No texts. No notifications. No asking.
          </p>

          <a
            href="/create"
            className="inline-block bg-black text-white px-8 py-4 rounded-xl text-lg"
          >
            Create a space
          </a>
        </div>
      </div>
    </div>
  )
}
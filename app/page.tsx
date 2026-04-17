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
  subtitle: string | null
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
          subtitle: null,
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
          subtitle: null,
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
      <div className="text-center px-6">
        <h1 className="text-5xl font-bold mb-6">GLANCEABLE</h1>

        <p className="text-gray-600 mb-8">
          A shared place for what’s happening now.
        </p>

        <a
          href="/create"
          className="inline-block bg-black text-white px-8 py-4 rounded-xl text-lg"
        >
          Create a space
        </a>
      </div>
    </div>
  )
}
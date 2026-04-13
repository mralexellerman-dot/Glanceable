'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SpaceBoard from '@/components/SpaceBoard'
import { getMemberForSpace, trackSpace } from '@/lib/memberships'
import { supabase } from '@/lib/supabase'

export default function SpacePage() {
  const params  = useParams()
  const router  = useRouter()
  const spaceId = params.id as string
  const [memberId, setMemberId] = useState<string>('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      // Fast path: member ID stored during join flow — skip re-query to avoid redirect loop
      try {
        const raw = sessionStorage.getItem('dw_join_handoff')
        if (raw) {
          const { spaceId: joinedSpaceId, memberId: joinedMemberId } = JSON.parse(raw)
          if (joinedSpaceId === spaceId && joinedMemberId) {
            sessionStorage.removeItem('dw_join_handoff')
            trackSpace(spaceId)          // confirmed access
            setMemberId(joinedMemberId)
            setReady(true)
            return
          }
        }
      } catch {}

      const member = await getMemberForSpace(spaceId)
      if (member) {
        trackSpace(spaceId)              // confirmed access
        setMemberId(member.id)
        setReady(true)
        return
      }
      // Not a member — send through the invite/join flow so they get a name
      const { data: spaceData } = await supabase
        .from('spaces')
        .select('invite_code')
        .eq('id', spaceId)
        .single()
      if (spaceData?.invite_code) {
        router.replace(`/join/${spaceData.invite_code}`)
      } else {
        // Space not found — render SpaceBoard which will show an empty/error state
        setReady(true)
      }
    }
    init()
  }, [spaceId, router])

  if (!ready) return null

  return <SpaceBoard spaceId={spaceId} memberId={memberId} />
}

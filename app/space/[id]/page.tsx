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
    trackSpace(spaceId)
    async function init() {
      const member = await getMemberForSpace(spaceId)
      if (member) {
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

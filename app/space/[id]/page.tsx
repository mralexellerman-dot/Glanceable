'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SpaceBoard from '@/components/SpaceBoard'
import { getMemberForSpace, trackSpace, getBrowserId } from '@/lib/memberships'
import { supabase } from '@/lib/supabase'

export default function SpacePage() {
  const params = useParams()
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
      // Auto-join: new device visiting a shared /space/:id link
      const browserId = getBrowserId()
      if (browserId) {
        const { data: inserted } = await supabase
          .from('members')
          .insert({ space_id: spaceId, browser_id: browserId, display_name: 'Guest', presence_state: 'tbd', role: 'member' })
          .select('id')
          .single()
        setMemberId(inserted?.id ?? '')
      }
      setReady(true)
    }
    init()
  }, [spaceId])

  if (!ready) return null

  return <SpaceBoard spaceId={spaceId} memberId={memberId} />
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SpaceBoard from '@/components/SpaceBoard'
import { getMemberForSpace } from '@/lib/memberships'

export default function SpacePage() {
  const params = useParams()
  const spaceId = params.id as string
  const [memberId, setMemberId] = useState<string>('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getMemberForSpace(spaceId).then(member => {
      setMemberId(member?.id ?? '')
      setReady(true)
    })
  }, [spaceId])

  if (!ready) return null

  return <SpaceBoard spaceId={spaceId} memberId={memberId} />
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SpaceBoard from '@/components/SpaceBoard'

export default function SpacePage() {
  const params = useParams()
  const spaceId = params.id as string
  const [memberId, setMemberId] = useState<string>('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedMemberId = localStorage.getItem('dw_member_id') ?? ''
    const storedSpaceId = localStorage.getItem('dw_space_id') ?? ''

    // Keep localStorage in sync if navigating directly to a space URL
    if (storedSpaceId !== spaceId) {
      localStorage.setItem('dw_space_id', spaceId)
    }

    setMemberId(storedMemberId)
    setReady(true)
  }, [spaceId])

  if (!ready) return null

  return <SpaceBoard spaceId={spaceId} memberId={memberId} />
}

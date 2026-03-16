import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'

export interface SpaceMembership {
  member_id: string
  space_id: string
  role: 'owner' | 'member'
  space: {
    id: string
    name: string
    invite_code: string
    created_at: string
  }
}

// Returns the persistent browser identity, creating one on first call.
export function getBrowserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('dw_browser_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('dw_browser_id', id)
  }
  return id
}

// All spaces this browser belongs to, newest first.
export async function getUserMemberships(): Promise<SpaceMembership[]> {
  const browserId = getBrowserId()
  if (!browserId) return []

  const { data } = await supabase
    .from('members')
    .select('id, space_id, role, space:spaces(id, name, invite_code, created_at)')
    .eq('browser_id', browserId)
    .order('created_at', { ascending: false })

  if (!data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map(d => ({
    member_id: d.id,
    space_id: d.space_id,
    role: d.role,
    space: d.space,
  }))
}

// The member row for this browser in a specific space, or null if not a member.
export async function getMemberForSpace(spaceId: string): Promise<Member | null> {
  const browserId = getBrowserId()
  if (!browserId) return null

  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('space_id', spaceId)
    .eq('browser_id', browserId)
    .single()

  return data ?? null
}

// POST /api/presence
// Used by iOS Shortcuts for lock screen / one-tap presence updates.
// Auth: member_id UUID acts as the credential (RLS is permissive for MVP).
//
// Body: { member_id: string, state: string }
// Response: { ok: true, state: string } | { error: string }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_STATES = ['home', 'away', 'out', 'at_work', 'dnd', 'tbd'] as const

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { member_id, state } = body as Record<string, unknown>

  if (typeof member_id !== 'string' || !member_id) {
    return NextResponse.json({ error: 'member_id required' }, { status: 400 })
  }
  if (!VALID_STATES.includes(state as typeof VALID_STATES[number])) {
    return NextResponse.json({ error: `state must be one of: ${VALID_STATES.join(', ')}` }, { status: 400 })
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  )

  const { error } = await client
    .from('members')
    .update({ presence_state: state, presence_updated_at: new Date().toISOString() })
    .eq('id', member_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, state })
}

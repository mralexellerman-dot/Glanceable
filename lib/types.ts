export type PresenceState = 'home' | 'away' | 'dnd' | 'tbd'
export type MemberRole = 'owner' | 'member'

export interface Space {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface Member {
  id: string
  space_id: string
  display_name: string
  presence_state: PresenceState
  role: MemberRole
  created_at: string
}

export interface Reaction {
  id: string
  event_id: string
  member_id: string | null
  emoji: string
  created_at: string
  member?: Pick<Member, 'id' | 'display_name'>
}

export interface Event {
  id: string
  space_id: string
  member_id: string | null
  emoji: string
  label: string
  note?: string | null
  created_at: string
  member?: Pick<Member, 'id' | 'display_name'>
  reactions?: Reaction[]
}

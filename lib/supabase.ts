import { createClient } from '@supabase/supabase-js'

// Fallbacks prevent build-time crashes when env vars aren't set.
// At runtime, real values are required for the app to function.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

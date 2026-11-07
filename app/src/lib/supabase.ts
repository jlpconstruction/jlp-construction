import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// `null` until the keys are in `.env` (see `.env.example`), so the site
// still runs before the Supabase project exists.
// PKCE: after "Sign in with Google", Supabase sends back a one-time code that
// the client swaps for a session (safer than putting tokens in the URL).
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { flowType: 'pkce' } }) : null

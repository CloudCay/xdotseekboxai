import { createClient } from '@supabase/supabase-js'
import { optionalEnv } from './env'

const url = optionalEnv('EXPO_PUBLIC_SUPABASE_URL')
const anon = optionalEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

export const supabase =
  url && anon
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const isSupabaseConfigured = Boolean(url && anon)


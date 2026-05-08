import { createClient } from '@supabase/supabase-js'
import { optionalEnv } from './env'

function fromViteEnv(key: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite env access
    const v = (import.meta as any)?.env?.[key]
    return typeof v === 'string' && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

// Vite only exposes VITE_* to browser bundles. Support BOTH so Netlify can set
// either, and TanStack Start server code can still see EXPO_PUBLIC_*.
const url = fromViteEnv('VITE_SUPABASE_URL') ?? optionalEnv('EXPO_PUBLIC_SUPABASE_URL')
const anon = fromViteEnv('VITE_SUPABASE_ANON_KEY') ?? optionalEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

export const supabase =
  url && anon
    ? createClient(url, anon, {
        global: {
          // Some proxies / environments can drop default headers; force the API key on every request.
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export const isSupabaseConfigured = Boolean(url && anon)


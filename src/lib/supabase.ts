import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { optionalEnv } from './env'

function cleanEnvValue(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

function isLegacyJwtKey(value: string): boolean {
  return value.startsWith('eyJ')
}

// Vite only exposes VITE_* to browser bundles. Support BOTH so Netlify can set
// either, and TanStack Start server code can still see EXPO_PUBLIC_*.
const url = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL) ?? optionalEnv('EXPO_PUBLIC_SUPABASE_URL')
const publicKey =
  cleanEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  optionalEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
  cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) ??
  optionalEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY')

let browserClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined' || !url || !publicKey) return null
  if (!browserClient) {
    browserClient = createClient(url, publicKey, {
      global: {
        // Some proxies / environments can drop default headers; force the API key on every request.
        // New Supabase publishable keys are not JWTs, so only legacy anon keys
        // should be duplicated into Authorization for anonymous requests.
        headers: {
          apikey: publicKey,
          ...(isLegacyJwtKey(publicKey) ? { Authorization: `Bearer ${publicKey}` } : {}),
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}

export const supabase = getSupabaseClient()

export const isSupabaseConfigured = Boolean(url && publicKey)

import type { User } from '@supabase/supabase-js'
import { getClientId } from './clientId'
import { supabase } from './supabase'

function safeSlug(user: User): string {
  const email = user.email ?? ''
  if (!email) return `anon-${user.id.slice(0, 8)}`
  const cleaned = email
    .toLowerCase()
    .replace(/@/g, '-')
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48)
  return cleaned || `user-${user.id.slice(0, 8)}`
}

async function callEnsureAccount(args: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('ensure_account', args)
  if (error) throw new Error(`ensure_account failed: ${error.message}`)
}

/**
 * Create/update `accounts` via the `ensure_account` SECURITY DEFINER RPC.
 * This avoids schema mismatches (e.g. no `accounts.google_id`) and bypasses RLS.
 *
 * Note: your DB has two `ensure_account` variants; we try the newer signature
 * (with optional TOS/cookie args) and fall back to the minimal signature.
 */
export async function ensureAccount(user: User): Promise<void> {
  const ref =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('__sbx_ref_source') ?? ''
      : ''
  const clientId = getClientId()
  const slug = safeSlug(user)

  const baseArgs = {
    p_user_id: user.id,
    p_email: user.email ?? '',
    p_slug: slug,
    // DB function forces 'anon' -> 'trial' for signed-in users.
    p_role: 'anon',
    p_ref: ref,
    p_client_id: clientId,
    p_created_via: user.email ? 'otp_email' : 'anonymous',
  }

  try {
    await callEnsureAccount({
      ...baseArgs,
      // Newer function variant (safe defaults).
      p_cookie_consent: null,
      p_tos_version: null,
      p_tos_ip: null,
      p_tos_country: null,
    })
  } catch (e) {
    // Fallback to minimal variant if the above didn't match.
    await callEnsureAccount(baseArgs)
  }
}


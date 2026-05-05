import { createServerFn } from '@tanstack/react-start';

function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/$/, '')
  if (!v) throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set')
  if (!/^https?:\/\//i.test(v)) {
    throw new Error(`EXPO_PUBLIC_BACKEND_URL must include https:// (got: ${v})`)
  }
  return v
}

export const upsertAccount = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    google_id: string;
    email: string;
    name: string;
    /** Cloudflare Turnstile token (same pattern as SeekBox web sign-in). */
    turnstileToken?: string;
  }) => data)
  .handler(async ({ data }) => {
    const BACKEND_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL)

    const res = await fetch(`${BACKEND_URL}/api/accounts/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_id: data.google_id,
        email: data.email?.trim()?.toLowerCase(),
        name: data.name?.trim(),
        ...(data.turnstileToken ? { turnstile_token: data.turnstileToken } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to upsert account: ${res.statusText}`);
    }

    const { data: account } = await res.json();
    const userId = account.id; // ← Supabase user ID (UUID)
    
    return { account, userId };
  });

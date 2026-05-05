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
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    const payload =
      data && typeof data === 'object' && 'data' in (data as any) ? (data as any).data : data
    if (!payload?.google_id) throw new Error('Invalid upsert payload (missing google_id)')
    if (!payload?.email) throw new Error('Invalid upsert payload (missing email)')
    if (!payload?.name) throw new Error('Invalid upsert payload (missing name)')

    const BACKEND_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL)

    const res = await fetch(`${BACKEND_URL}/api/accounts/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        google_id: payload.google_id,
        email: String(payload.email)?.trim()?.toLowerCase(),
        name: String(payload.name)?.trim(),
        ...(payload.turnstileToken ? { turnstile_token: payload.turnstileToken } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Failed to upsert account: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`);
    }

    const { data: account } = await res.json();

    return { account };
  });

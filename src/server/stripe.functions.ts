import { createServerFn } from '@tanstack/react-start'

function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/$/, '')
  if (!v) throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set')
  if (!/^https?:\/\//i.test(v)) {
    throw new Error(`EXPO_PUBLIC_BACKEND_URL must include https:// (got: ${v})`)
  }
  return v
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((data: any) => data)
  .handler(async ({ data }) => {
    const payload =
      data && typeof data === 'object' && 'data' in (data as any) ? (data as any).data : data
    if (!payload?.priceId) throw new Error('Invalid checkout payload (missing priceId)')
    if (!payload?.userId) throw new Error('Invalid checkout payload (missing userId)')
    if (!payload?.email) throw new Error('Invalid checkout payload (missing email)')
    if (!payload?.successUrl) throw new Error('Invalid checkout payload (missing successUrl)')
    if (!payload?.cancelUrl) throw new Error('Invalid checkout payload (missing cancelUrl)')

    const BACKEND_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL)

    const res = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: payload.priceId,
        userId: payload.userId,
        email: String(payload.email)?.trim()?.toLowerCase(),
        successUrl: payload.successUrl,
        cancelUrl: payload.cancelUrl,
        ...(payload.trialDays ? { trialDays: payload.trialDays } : {}),
        ...(payload.referredBy ? { referredBy: payload.referredBy } : {}),
      }),
    })

    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(
        `Failed to create checkout session: ${res.status} ${typeof json === 'string' ? json : JSON.stringify(json)}`,
      )
    }

    const url: string | undefined = (json as any)?.data?.url ?? (json as any)?.url
    if (!url) throw new Error('Missing checkout URL in response')

    return { url }
  })


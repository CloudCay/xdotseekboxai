import { createServerFn } from '@tanstack/react-start'

const DEFAULT_PAYMENTS_API_URL = 'https://api.seekbox.ai'

function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? DEFAULT_PAYMENTS_API_URL).trim().replace(/\/$/, '')
  if (!v) throw new Error('Payments API URL is not set')
  if (!/^https?:\/\//i.test(v)) {
    throw new Error(`Payments API URL must include https:// (got: ${v})`)
  }
  return v
}

function paymentsApiUrl(): string {
  return normalizeBaseUrl(
    process.env.VITE_PAYMENTS_API_URL ??
      process.env.EXPO_PUBLIC_PAYMENTS_API_URL ??
      process.env.VITE_API_URL ??
      process.env.EXPO_PUBLIC_API_URL ??
      DEFAULT_PAYMENTS_API_URL,
  )
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

    const PAYMENTS_API_URL = paymentsApiUrl()

    const res = await fetch(`${PAYMENTS_API_URL}/v1/payments/checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App': 'x.seekboxai.com',
        'X-Feature': 'checkout',
        'X-User-Id': payload.userId,
      },
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

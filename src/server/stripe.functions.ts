import { createServerFn } from '@tanstack/react-start'

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    priceId: string
    userId: string
    email: string
    successUrl: string
    cancelUrl: string
    trialDays?: number
    referredBy?: string
  }) => data)
  .handler(async ({ data }) => {
    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL
    if (!BACKEND_URL) {
      throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set')
    }

    const res = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: data.priceId,
        userId: data.userId,
        email: data.email,
        successUrl: data.successUrl,
        cancelUrl: data.cancelUrl,
        ...(data.trialDays ? { trialDays: data.trialDays } : {}),
        ...(data.referredBy ? { referredBy: data.referredBy } : {}),
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


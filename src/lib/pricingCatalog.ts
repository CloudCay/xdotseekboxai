export type BillingInterval = 'month' | 'year'

export type PricingPlan = {
  id: string
  tier: string
  title: string
  subtitle: string
  priceId: string
  displayAmount: string
  listAmount?: string
  discountAmount?: string
  discountLabel?: string
  interval: BillingInterval
  badge: string
  features: string[]
}

const env = (import.meta as any).env as Record<string, string | undefined>

function envValue(name: string): string | null {
  const value = env?.[name]?.trim()
  return value ? value : null
}

const legacyPriceSet = envValue('VITE_STRIPE_PRICESET')

export const POWER_LIVE_X_MONTHLY_PLAN: PricingPlan = {
  id: 'power-live-x-monthly',
  tier: 'Power tier',
  title: 'X.SeekBoxAI + Live X',
  subtitle: 'Multi-model search with live X and web context.',
  priceId:
    envValue('VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY') ??
    (legacyPriceSet === 'test_current' ? 'price_1TTWUTAghz6CNDMATSskXYmY' : 'price_1TTf7OAghz6CNDMAjyhVsGkZ'),
  displayAmount: envValue('VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY_DISPLAY') ?? '$20.20',
  listAmount: envValue('VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY_LIST_DISPLAY') ?? '$24.20',
  discountAmount: envValue('VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY_DISCOUNT_DISPLAY') ?? '$4.00',
  discountLabel: 'Launch coupon applied in Stripe checkout',
  interval: 'month',
  badge: 'Monthly',
  features: [
    '10+ models and search sources in one run',
    'Live X mode and Deep Live Dive',
    'Search history when signed in',
    'Prompt modifiers and model/source controls',
    'Account role and subscription status',
    'Priority path for new X intelligence features',
  ],
}

export const PRICING_PLANS = [POWER_LIVE_X_MONTHLY_PLAN] as const

export function pricingPlanForId(planId: string | null | undefined): PricingPlan {
  return PRICING_PLANS.find((plan) => plan.id === planId) ?? POWER_LIVE_X_MONTHLY_PLAN
}

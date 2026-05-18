import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/pricing')({
  beforeLoad: () => {
    throw redirect({ to: '/plans' })
  },
  component: PricingRedirect,
})

function PricingRedirect() {
  return null
}

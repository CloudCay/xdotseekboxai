import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/helper')({
  beforeLoad: () => {
    throw redirect({ to: '/seekly' })
  },
})

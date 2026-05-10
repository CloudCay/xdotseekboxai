import { createFileRoute } from '@tanstack/react-router'
import { SeeklyPage } from '@/components/seekly/SeeklyPage'

export const Route = createFileRoute('/seekly')({
  component: SeeklyPage,
})

import { createFileRoute } from '@tanstack/react-router'
import { PulseReaderPage } from '../components/PulseReaderPage'

export const Route = createFileRoute('/pulse')({
  component: PulseReaderPage,
})

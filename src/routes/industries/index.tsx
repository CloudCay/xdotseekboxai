import { createFileRoute } from '@tanstack/react-router'
import { IndustryHubPage } from '../../components/IndustryPulsePage'

export const Route = createFileRoute('/industries/')({
  component: IndustryHubPage,
})

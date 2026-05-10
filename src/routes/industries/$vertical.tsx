import { createFileRoute } from '@tanstack/react-router'
import { IndustryPulsePage } from '../../components/IndustryPulsePage'

export const Route = createFileRoute('/industries/$vertical')({
  component: IndustryRoute,
})

function IndustryRoute() {
  const { vertical } = Route.useParams()
  return <IndustryPulsePage slug={vertical} />
}

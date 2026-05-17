import { createFileRoute } from '@tanstack/react-router'
import { VoiceProfilePage } from '../../components/VoiceProfilePage'

export const Route = createFileRoute('/voices/$handle')({
  component: VoiceRoute,
})

function VoiceRoute() {
  const { handle } = Route.useParams()
  return <VoiceProfilePage handle={handle} />
}

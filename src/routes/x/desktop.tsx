import { createFileRoute } from '@tanstack/react-router'
import { CleanSeekLite } from '../cleanseek-x'

export const Route = createFileRoute('/x/desktop')({
  component: () => <CleanSeekLite variant="desktop" disableGrokLive />,
})

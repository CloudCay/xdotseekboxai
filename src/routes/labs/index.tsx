import { createFileRoute } from '@tanstack/react-router'
import { XIntelOverview } from '../../components/xIntel/XIntelTools'

export const Route = createFileRoute('/labs/')({
  head: () => ({
    meta: [{ title: 'X.SeekBoxAI Intel' }],
  }),
  component: XIntelOverview,
})

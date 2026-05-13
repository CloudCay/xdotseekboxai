import { createFileRoute } from '@tanstack/react-router'
import { XBattleTool } from '../../components/xIntel/XIntelTools'

export const Route = createFileRoute('/labs/x-battle')({
  head: () => ({
    meta: [{ title: 'X Battle — X.SeekBoxAI Intel' }],
  }),
  component: XBattleTool,
})

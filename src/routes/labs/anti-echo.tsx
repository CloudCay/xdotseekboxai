import { createFileRoute } from '@tanstack/react-router'
import { AntiEchoTool } from '../../components/xIntel/XIntelTools'

export const Route = createFileRoute('/labs/anti-echo')({
  head: () => ({
    meta: [{ title: 'Anti-Echo — X.SeekBoxAI Intel' }],
  }),
  component: AntiEchoTool,
})

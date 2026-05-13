import { createFileRoute } from '@tanstack/react-router'
import { PostRoomTool } from '../../components/xIntel/XIntelTools'

export const Route = createFileRoute('/labs/post-room')({
  head: () => ({
    meta: [{ title: 'Post Room — X.SeekBoxAI Intel' }],
  }),
  component: PostRoomTool,
})

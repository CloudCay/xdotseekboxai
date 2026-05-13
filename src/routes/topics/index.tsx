import { createFileRoute } from '@tanstack/react-router'
import { TopicTagsPage } from '../../components/TopicTagsPage'

export const Route = createFileRoute('/topics/')({
  component: TopicTagsPage,
})

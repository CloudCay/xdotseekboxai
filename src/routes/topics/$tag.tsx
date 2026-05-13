import { createFileRoute } from '@tanstack/react-router'
import { TopicTagsPage } from '../../components/TopicTagsPage'

export const Route = createFileRoute('/topics/$tag')({
  component: TopicRoute,
})

function TopicRoute() {
  const { tag } = Route.useParams()
  return <TopicTagsPage tagSlug={tag} />
}

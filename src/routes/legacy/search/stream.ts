import { createFileRoute } from '@tanstack/react-router'
import { legacySearchApiUrl, proxySearchRequest } from '../../../server/searchProxy'

export const Route = createFileRoute('/legacy/search/stream')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => proxySearchRequest(request, legacySearchApiUrl('/api/search/stream'), 'stream'),
      POST: async ({ request }) => proxySearchRequest(request, legacySearchApiUrl('/api/search/stream'), 'stream'),
    },
  },
})

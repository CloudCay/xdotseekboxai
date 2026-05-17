import { createFileRoute } from '@tanstack/react-router'
import { proxySearchRequest, seekboxApiUrl } from '../../../server/searchProxy'

export const Route = createFileRoute('/api/search/stream')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/api/search/stream'), 'stream'),
      POST: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/api/search/stream'), 'stream'),
    },
  },
})

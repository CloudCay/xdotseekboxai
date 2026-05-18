import { createFileRoute } from '@tanstack/react-router'
import { proxySearchRequest, seekboxApiUrl } from '../../server/searchProxy'

export const Route = createFileRoute('/v1/search')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/v1/search'), 'json'),
      POST: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/v1/search'), 'json'),
    },
  },
})

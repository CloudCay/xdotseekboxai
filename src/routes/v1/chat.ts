import { createFileRoute } from '@tanstack/react-router'
import { proxySearchRequest, seekboxApiUrl } from '../../server/searchProxy'

export const Route = createFileRoute('/v1/chat')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/v1/chat'), 'stream'),
      POST: async ({ request }) => proxySearchRequest(request, seekboxApiUrl('/v1/chat'), 'stream'),
    },
  },
})

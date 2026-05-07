import { createFileRoute } from '@tanstack/react-router'
import { formatSupplementaryPrefix, gatherSupplementaryContext } from '../../server/supplementarySources'

export const Route = createFileRoute('/api/supplementary')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { query?: unknown; symbols?: unknown }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Expected JSON body' }, { status: 400 })
        }
        const query = typeof body.query === 'string' ? body.query : ''
        const symbols = Array.isArray(body.symbols)
          ? body.symbols.filter((x): x is string => typeof x === 'string')
          : undefined

        const payload = await gatherSupplementaryContext({
          query,
          symbols,
          twelveApiKey: process.env.TWELVE_API_KEY,
        })
        const prefix = formatSupplementaryPrefix(payload)
        return Response.json({ ...payload, prefix })
      },
    },
  },
})

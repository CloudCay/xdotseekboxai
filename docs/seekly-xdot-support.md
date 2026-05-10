# Seekly xdot Support Layer

Seekly should scale as one helper with shared baseline functions plus a site-specific support profile.

## Baseline Functions

These functions stay shared across SeekBox surfaces:

- Explain product behavior
- Triage support issues
- Collect feedback
- Guide search
- Discuss roadmap

Each chat turn still calls the same Supabase Edge Function:

- `${VITE_SUPABASE_URL}/functions/v1/helper`

No backend contract change is required for the xdot support layer. The site context is carried in `pageContext`.

## xdot Site Profile

The xdot site profile lives in:

- `src/lib/helper/siteProfile.ts`

It tells Seekly:

- product: `SeekBoX Pulse`
- site id: `seekbox-xdot`
- staging host: `x.seekboxai.com`
- positioning: `LIVE SEEKBOX CACHE`
- canonical surfaces:
  - Pulse reader
  - Industry pages
  - CleanSeek-X
  - Ticker
  - The Spot by SeekBoxAi / XMarks
  - Account and sign-in
  - Seekly direct page

## Route Support

Each route support entry defines:

- route match
- surface label
- surface description
- support scope
- starter prompts

The floating helper uses the current route to set:

- panel subtitle
- empty-state support text
- starter prompts
- backend `pageContext`

This lets the same helper answer differently on `/ticker` than on `/account` without forking the helper itself.

## Next Backend Step

When the Cloudflare Worker helper is ready, preserve this shape:

```ts
type HelperSiteContext = {
  siteId: string
  productName: string
  surfaceId: string
  route: string
  supportScope: string[]
}
```

Until then, the xdot site profile remains a safe frontend seed.

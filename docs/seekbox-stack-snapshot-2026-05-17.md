# SeekBox Technical Stack Snapshot

Date: 2026-05-17
Scope: current local repositories, docs, API notes, Netlify/TanStack frontends, Supabase SQL assets, and the near-term domain plan for `x.seekbox.ai`, `seekbox.ai`, and `api.seekbox.ai`.

## Executive Summary

SeekBox is currently a family of related apps around one core idea: a user-facing search and intelligence product backed by a provider-routing API gateway. The near-term target architecture should be:

| Domain | Role | Near-term owner |
| --- | --- | --- |
| `seekbox.ai` | Canonical main SeekBox product: search, account, billing, library, uploads, business/plans, and general product surface | `seekbox-main-react` first, then whatever replaces the legacy/mobile web stack |
| `x.seekbox.ai` | Canonical X/Pulse intelligence product: CleanSeek X, Pulse, voices, topics, labs, industry/ticker signal pages | `xdotseekboxai` |
| `api.seekbox.ai` | Production SeekBox API gateway: provider secrets, search/chat routing, pulse/news/voice jobs, payments, auth helpers, image/file/music enrichment, admin endpoints | Cloudflare Worker `seekbox-api` |

As of this snapshot:

- `api.seekbox.ai/health` responds with `{ ok: true }`, but still reports `env: "canary"`. Treat that as a production-cutover cleanup item.
- `seekbox.ai` responds over Netlify.
- `x.seekbox.ai` does not currently resolve in DNS from this machine.
- `x.seekboxai.com` responds over Netlify and appears to be the current transition/staging host for the X/Pulse product.
- The canonical API document is currently outside this repo at `/Users/cloudsherpasadmin/SeekBoxLocal/V1-API-v1.7-2026-05-14.md`.
- The xdot repo has active local WIP at snapshot time. Do not assume the worktree exactly matches GitHub without checking status.

## Source Inventory

### Primary Local Assets

| Path | Purpose | Status notes |
| --- | --- | --- |
| `/Users/cloudsherpasadmin/SeekBoxLocal/xdotseekboxai` | TanStack Start app for X/Pulse/CleanSeek X | GitHub repo `CloudCay/xdotseekboxai`; current branch `codex-clean-git-checkpoint-20260516` |
| `/Users/cloudsherpasadmin/SeekBoxLocal/seekbox-main-react` | Vite React main SeekBox web app | Main search refresh surface; currently separate from xdot |
| `/Users/cloudsherpasadmin/SeekBoxLocal/Website/mobile` | Legacy/main Expo and web codebase | Still contains many refreshed routes/components; source of prior SeekBox UI and product patterns |
| `/Users/cloudsherpasadmin/SeekBoxLocal/V1-API-v1.7-2026-05-14.md` | Canonical v1 API reference as of 2026-05-14 | Live-verified against `api.seekbox.ai` for `/v1/chat` and `/v1/search` |
| `/Users/cloudsherpasadmin/SeekBoxLocal/sbx-ops-admin` | Admin/ops app | Vite + React 18, Supabase, role/permissions/session/cost surfaces; keep private |
| `/Users/cloudsherpasadmin/SeekBoxLocal/tour.seekbox.ai` | StarsAlign/music sub-app | Vite + React 19, Supabase `tour` schema, Soundcharts/Spotify docs and scripts |
| `/Users/cloudsherpasadmin/SeekBoxLocal/dociagent.seekbox.ai` | DociAgent sub-app shell | Vite + React 19 starter |
| `/Users/cloudsherpasadmin/SeekBoxLocal/integrations/xdotseekbox-checkout` | Older checkout integration snippet | Still references the legacy `ruffled-snail.vibecode.run` backend |
| `/Users/cloudsherpasadmin/SeekBoxLocal/shared-types` | Shared local type assets | Candidate for extraction into a shared package |

### Git State At Snapshot

`xdotseekboxai`:

- Remote: `git@github.com:CloudCay/xdotseekboxai.git`
- Current branch: `codex-clean-git-checkpoint-20260516`
- Pushed checkpoint branch: `618285f Constrain matrix engine labels`
- Separate pushed WIP branch: `codex/arena-gateway-cleanup-20260517` at `e4e35e0 Add arena and gateway run rollups`
- Local dirty WIP exists at snapshot time around pulse metrics, ranking pipeline, pulse API routes, and CleanSeek X. These should be preserved and reviewed separately.

Current uncommitted xdot areas include:

- `src/components/IndustryPulsePage.tsx`
- `src/components/PulseReaderPage.tsx`
- `src/routes/api/pulse-runs.ts`
- `src/routes/api/x-discover.ts`
- `src/routes/cleanseek-x.tsx`
- `supabase/pulse_runs_public.sql`
- `docs/pulse-run-metrics.md`
- `docs/seekbox-candidate-ranking-core.md`
- `src/lib/pulseMetrics.ts`
- `src/lib/rankingPipeline.ts`
- `supabase/core_candidate_ranking.sql`

`seekbox-main-react`:

- Local repo status is not clean. It is part of a larger dirty parent workspace with many files changed under `Website/mobile` and adjacent docs. Treat it as valuable WIP, not a clean deploy source, until branch/status are normalized.

## Current xdotseekboxai Stack

### Framework And Build

| Layer | Current implementation |
| --- | --- |
| Framework | TanStack Start |
| Router | TanStack Router file routes |
| Frontend | React 19.2 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 plus custom global CSS |
| Icons | Lucide React |
| Markdown rendering | `react-markdown`, `remark-gfm` |
| Auth/data client | Supabase JS |
| Deployment | Netlify with `@netlify/vite-plugin-tanstack-start` |
| Local dev | `npm run dev` on Vite port 3000, or `netlify dev` on port 8888 |

`netlify.toml` publishes `dist/client`, runs `vite build`, serves favicon/icon assets directly, and proxies these paths to the production API:

- `/api/search/stream` -> `https://api.seekbox.ai/api/search/stream`
- `/v1/chat` -> `https://api.seekbox.ai/v1/chat`
- `/v1/search` -> `https://api.seekbox.ai/v1/search`
- `/legacy/search/stream` -> `https://ruffled-snail.vibecode.run/api/search/stream`

### Main Product Surfaces

| Route area | Purpose |
| --- | --- |
| `/` | X/Pulse-oriented homepage and entry surface |
| `/cleanseek-x` and `/cleanseek-x/desktop` | Multi-engine search and X-focused research UI |
| `/x` and `/x/desktop` | X-branded product entry routes |
| `/pulse` | Pulse reader |
| `/topics`, `/topics/$tag` | Topic tag drilldowns |
| `/voices/$handle` | Voice profile pages |
| `/industries`, `/industries/$vertical` | Industry pulse pages |
| `/labs` and `/labs/*` | X Intel tools: Matrix, X Battle, Post Room, Anti-Echo |
| `/seeds`, `/seed-lab` | Prompt seed and collection surfaces |
| `/xraw`, `/xmarks`, `/ticker` | Raw playground, saved X marks, market/ticker surface |
| `/plans`, `/pricing`, `/account`, `/checkout`, `/success`, `/signin` | Billing/account/auth surfaces. `/pricing` redirects to `/plans`. |
| `/second-opinion` | Second-opinion extension/product support |
| `/helper`, `/seekly` | Seekly/helper support surfaces |

Billing funnel note: the current anonymous-to-subscriber route map is documented in
[`docs/anon-to-subscriber-flow.md`](./anon-to-subscriber-flow.md). In short, `/signin` is both sign-in and sign-up,
`/plans` explains the plan, `/pricing` redirects there for compatibility, `/checkout` auto-starts Stripe for signed-in
users, and `/account` sends unpaid users to the plan surface first.

### Server Routes And Server Functions

| Area | Current role |
| --- | --- |
| `src/server/searchProxy.ts` | Proxies search/chat requests to `api.seekbox.ai` or legacy backend; strips public cost fields from JSON and SSE responses |
| `src/routes/api/search/stream.ts` | Site-level stream route using the proxy |
| `src/routes/v1/chat.ts`, `src/routes/v1/search.ts` | Local route shims to the API gateway |
| `src/routes/api/x-intel/*` | Server-side X Intel proxies that call the gateway and return sanitized, parsed public payloads |
| `src/lib/xIntel/server.ts` | X Intel gateway client, per-client rate limits, timeout handling |
| `src/routes/api/gateway-logs.ts` | Internal/admin-oriented stats and cost rollup fetcher from `api.seekbox.ai` |
| `src/routes/api/pulse-runs.ts`, `src/routes/api/pulse-voices.ts` | Public-safe Pulse/voice data endpoints backed by Supabase public views or fallbacks |
| `src/routes/api/x-discover.ts` | X discovery workflow with bearer token support and Supabase persistence |
| `src/routes/api/second-opinion.ts` | Second-opinion app/extension backend route |
| `src/routes/api/supplementary.ts` | Supplemental data, including Twelve Data quote support |
| `src/server/stripe.functions.ts` | Checkout/session client for payments API |
| `src/server/accounts.functions.ts` | Account helper functions |

### Environment Variables

The local `.env.local` contains only public-safe keys in code paths plus admin/server secrets. Values must never be committed.

Observed xdot env keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL`
- `EXPO_PUBLIC_BACKEND_URL`
- `VITE_TURNSTILE_SITE_KEY`
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`
- `SBX_ADMIN_TOKEN`

Other code-supported env keys include:

- `VITE_SEEKBOX_API_URL`
- `EXPO_PUBLIC_SEEKBOX_API_URL`
- `SEEKBOX_API_URL`
- `SEEKBOX_GATEWAY_URL`
- `SEEKBOX_X_INTEL_GATEWAY_URL`
- `SEEKBOX_API_KEY`
- `SEEKBOX_ADMIN_TOKEN`
- `VITE_LEGACY_BACKEND_URL`
- `EXPO_PUBLIC_LEGACY_BACKEND_URL`
- `VITE_PAYMENTS_API_URL`
- `EXPO_PUBLIC_PAYMENTS_API_URL`
- `TWELVE_DATA_API_KEY`
- `TWELVE_API_KEY`
- `X_BEARER_TOKEN`
- `X_API_BEARER_TOKEN`
- `TWITTER_BEARER_TOKEN`
- `TWITTER_API_BEARER_TOKEN`

Near-term recommendation: standardize all browser/frontend API base configuration to `VITE_SEEKBOX_API_URL=https://api.seekbox.ai`, keep `VITE_BACKEND_URL` as compatibility only, and document which server-only secrets belong in Netlify versus Cloudflare versus Supabase Edge Functions.

## Current seekbox-main-react Stack

`seekbox-main-react` is a Vite React 19 app, not TanStack Start. It appears to be the current working main-web refresh surface and should inform `seekbox.ai`.

| Layer | Current implementation |
| --- | --- |
| Frontend | React 19.2 |
| Build | Vite 7 plus TypeScript strict |
| Routing | In-app state/path handling, not TanStack Router |
| Styling | Large custom CSS surface |
| Data/auth | Supabase JS |
| Deployment | Netlify static SPA, `dist`, `/* -> /index.html` |

Main assets and capabilities observed:

- Main multi-provider search via `src/searchApi.ts`.
- Provider set: ChatGPT, Claude, Gemini, Groq, Grok, Tavily, Brave, Wikipedia, ChatGPT Search, Grok Search.
- Prompt modifiers: comprehension level, tone, reasoning style, flags, audience persona, perspective, location.
- Account, plans, business checkout, library, search history, shared sessions.
- File upload handoff through `/v1/files/*`, with Cloudflare/R2-oriented upload docs in code comments.
- Supabase-backed account/session/subscription/profile hydration.
- Pulse/industry read support from `public_pulse_runs` or `pulse_runs`.
- Lab/panel/Rabbithole-style workflows through `/v1/chat` and `/v1/seekbox/research`.

Netlify redirects mirror xdot for `/v1/chat`, `/v1/search`, `/api/search/stream`, and `/v1/files/*`.

Near-term recommendation: make this app the owner of `seekbox.ai`, then progressively move any reusable search, citation, account, and prompt-modifier code into a shared package consumed by both `seekbox.ai` and `x.seekbox.ai`.

## SeekBox API Gateway

The API gateway is documented as `seekbox-api`, a Cloudflare Worker exposed through `https://api.seekbox.ai`.

### Verified And Documented Behavior

From `V1-API-v1.7-2026-05-14.md`:

- `/v1/chat` was live-verified across OpenAI, Anthropic, Google AI Studio, xAI, and Groq.
- `/v1/search` was live-verified across Tavily, Brave, Wikipedia, and xAI web/search style providers.
- LCR/forced routing and common error shapes were confirmed.
- xAI old models `grok-3` and `grok-4-0709` are retired on the API side; `grok-4.3` and `grok-x` alias are documented as working.
- AI Gateway cache metadata exists internally.
- `X-App` is required by policy for every request, with `X-Feature` as the second attribution axis.
- Missing `X-App` is still accepted but logs into the `unknown` bucket.

Live check on 2026-05-17:

```json
{"ok":true,"env":"canary","ts":"2026-05-17T16:26:27.230Z"}
```

The `env: "canary"` value should be cleaned up before calling this production-final.

### API Areas

| API area | Purpose |
| --- | --- |
| `/health` | Health check |
| `/v1/chat` | Text generation across routed LLM providers |
| `/v1/search` | Non-LLM web/KB search |
| `/v1/data/weather`, `/v1/data/geocode`, `/v1/data/stocks` | Utility data APIs |
| `/v1/embed`, `/v1/recall`, `/v1/batch` | Embeddings, recall/RAG, async batch |
| `/v1/pulse` | Structured X intelligence brief generation |
| `/v1/feed/*` | Pulse/highlight/news feed readers |
| `/v1/voices/*` | Voice leaderboard/profile/candidate discovery |
| `/v1/enrich/topical-x` | Topic to current X/Pulse context |
| `/v1/image` | Image generation, dedupe, Cloudflare Images delivery |
| `/v1/payments/*` | Stripe checkout, webhook, portal, subscription |
| `/v1/auth/*` | Twilio Verify SMS auth and JWT helper endpoints |
| `/v1/admin/*` | Catalog, cron triggers, cost rollups, internal operations |
| `/api/*` compat aliases | Backward compatibility for older frontend paths |

### Cron And Background Work

Documented schedules:

- Every 30 minutes: per-industry news feed, RSS layer plus Tavily layer.
- Every 2 hours temporarily: pulse refresh across Supabase `pulse_catalog`.
- Daily: voice enrichment.

Other local app docs indicate a StarsAlign music refresh model using Supabase Edge Functions, `pg_cron`, `pg_net`, and Soundcharts/Spotify enrichment. That should be reconciled into the canonical API docs as v1.8.

### Music And Events API State

The older v1.7 API doc says `/v1/audio/music` is not built. Newer StarsAlign docs and scripts show these music-related assets:

- `GET /v1/enrich/spotify-artist?id=<spotifyId>` documented in `tour.seekbox.ai/docs/spotify-artist-route-spec.md`.
- `POST /v1/admin/run-music-enrichment` referenced by `tour.seekbox.ai/scripts/probe-music-api.*`.
- Soundcharts daily refresh docs and scripts.
- `tour_sb_schema.sql` includes `spotify_id`, `ticketmaster_id`, `ticketmaster_venue_id`, and Soundcharts identifiers.

Interpretation: Spotify/Soundcharts work appears to exist in newer project-specific docs and scripts, but it has not been folded back into the canonical `V1-API-v1.7` reference. Ticketmaster appears in the database schema as planned identifiers, but no local Worker route spec was found in the files inspected.

Near-term action: create `V1-API-v1.8` or equivalent and reconcile:

- Which music routes are live on `api.seekbox.ai`.
- Which are admin-only.
- Which are Supabase Edge Functions rather than Cloudflare Worker routes.
- Whether Ticketmaster is schema-only, planned, or implemented elsewhere.

## Data And Storage

### Supabase

Supabase is the shared system of record across current apps:

- xdot public Pulse data.
- main SeekBox accounts, search history, engine results, subscriptions, library files.
- StarsAlign `tour` schema.
- Admin dashboards and role/permissions experiments.

Important xdot SQL assets:

| File | Purpose |
| --- | --- |
| `supabase/pulse_runs_public.sql` | Public-safe view over private `pulse_runs`; adds public metric fields |
| `supabase/pulse_voice_rankings.sql` | Durable voice ranking table, public view, and upsert function |
| `supabase/core_candidate_ranking.sql` | WIP universal candidate ranking tables and public view |
| `supabase/roadmap_votes.sql` | Roadmap voting |
| `supabase/second_opinions_tables.sql` | Second-opinion product state |
| `supabase/ticker_tables.sql` | Ticker/market data |
| `supabase/xmarks_tables.sql` | Saved X marks |
| `supabase/migrations/20260510215000_create_unusual_whales_private_cache.sql` | Private Unusual Whales cache |

Public safety principle: browser-facing readers should use public views such as `public_pulse_runs`, `public_pulse_voice_rankings`, and `public_ranked_results`. Private run tables can retain prompts, provider payloads, costs, latency, errors, token counts, and diagnostics.

### Candidate Ranking WIP

The uncommitted ranking work defines a reusable pipeline:

1. Candidate sources.
2. Hydration.
3. Filters.
4. Scoring.
5. Selection.
6. Side effects/persistence.

Candidate source kinds already include `x`, `web`, `news`, `pulse`, `music`, `market_data`, `user_upload`, and `internal_seed`. This is the right abstraction for converging X/Pulse, main search, StarsAlign, and future vertical apps.

Near-term recommendation: keep this as `SeekBox Core Ranking`, not an xdot-only feature.

## Public Safety And Cost Metadata

This has been a recurring risk and should be treated as a release gate.

Current protections:

- `src/server/searchProxy.ts` recursively strips fields whose key includes `cost` or equals `billing` from public JSON and SSE payloads.
- `docs/x-intel-compliance.md` says not to return raw gateway responses, cost, latency, timing, usage, or provider metadata to the browser.
- X Intel server routes parse and sanitize gateway output before returning it.
- `public_pulse_runs` excludes raw prompts, raw provider payloads, cost, latency, tool details, and diagnostics.

Known risk areas:

- Admin/gateway cost rollups are useful, but must stay operator-only.
- The WIP branch `codex/arena-gateway-cleanup-20260517` contains Arena/gateway run rollup UI and should not be merged into public pages until admin/public separation is explicit.
- `sbx-ops-admin` intentionally displays internal cost information and should remain private.
- Some local docs under sub-app projects include explicit secrets or operational tokens. Do not publish them as-is. Rotate anything that has ever been committed or shared externally.

## Frontend Asset Inventory

### xdotseekboxai

Public assets:

- Favicons and app icons under `public/`.
- `seekbox-cube-logo.png`.
- `seekbox-second-opinions.zip`.

Extension:

- `extensions/seekbox-second-opinions/` contains a Manifest extension with popup assets and `seekbox-mark.svg`.

Design/product docs:

- `docs/domain-api-naming.md`
- `docs/x-intel-compliance.md`
- `docs/pulse-voice-ranking.md`
- `docs/whales-edition.md`
- `docs/seekly-xdot-support.md`
- `docs/personalization-seed.md`
- WIP docs for pulse metrics and candidate ranking.

### Main SeekBox Assets

Main/current assets appear split between:

- `seekbox-main-react/src/*`
- `Website/mobile/src/*`
- `Website/mobile/assets/*`
- parent-level product docs such as page architecture, consumption spec, profile architecture, competitive brief, onboarding/test plans.

This split is the main cleanup problem: product truth is spread across multiple directories and generations. The near-term solution is not a rewrite; it is a source-of-truth pass:

- `seekbox-main-react` should own the current `seekbox.ai` web deployment.
- `Website/mobile` should be treated as legacy/reference unless a route is explicitly still deployed from it.
- Shared product docs should move into one docs tree or a separate product-docs repo after secrets are scrubbed.

### Sub-App Assets

`tour.seekbox.ai` and `dociagent.seekbox.ai` show a repeatable sub-app pattern:

- Vite + React 19 + TypeScript strict.
- Netlify static deploy.
- One Supabase schema per sub-app.
- Thin use of `api.seekbox.ai` for provider credentials and enrichment.
- Path-based lightweight routing for sub-app shells.

This is useful for future vertical apps, but it should not distract from stabilizing the three core domains first.

## Target Architecture

### Domain Boundary

```text
Browser apps
  seekbox.ai        -> main product UI
  x.seekbox.ai      -> X/Pulse product UI
  future subapps    -> tour.seekbox.ai, dociagent.seekbox.ai, etc.

API gateway
  api.seekbox.ai    -> provider routing, secrets, policy, logging, billing, cron triggers

Data layer
  Supabase          -> auth, accounts, subscriptions, search history, pulse public views, vertical schemas
  Cloudflare        -> Worker runtime, AI Gateway, Images/R2 where needed, DNS
  Netlify           -> frontend hosting and TanStack/SPA deploys
```

### Rule Of Thumb

The browser may call:

- `api.seekbox.ai` for provider-backed work.
- Supabase public/authenticated APIs only for public-safe views and user-owned rows.
- Netlify local routes when they are thin shims that sanitize or adapt the gateway.

The browser should not call:

- OpenAI, Anthropic, xAI, Google, Tavily, Brave, Stripe secret APIs, Twilio, Soundcharts, Ticketmaster, or provider APIs directly.
- Admin cost endpoints.
- Private `pulse_runs` or raw run log tables.

### Shared Core To Extract

Create a shared package or internal module set for:

- API client and `X-App`/`X-Feature` conventions.
- Search provider IDs and model mapping.
- Citation rendering and source cards.
- Prompt modifier schema.
- Pulse metric utilities.
- Voice ranking helpers.
- Candidate ranking pipeline.
- Supabase table/view type definitions.
- Auth/account profile summary.
- Design tokens shared across main and X surfaces.

Do this incrementally. Avoid a monorepo migration until the domains are stable and the dirty working trees are clean.

## Near-Term Plan

### Phase 1: Stabilize What Exists

1. Keep the open xdot cleanup PR focused on public safety and build health.
2. Preserve unrelated local WIP on named branches before merging anything.
3. Do a secrets scrub before publishing any parent-level docs or sub-app docs.
4. Update API docs to v1.8 and reconcile Spotify/Soundcharts/music routes.
5. Verify `api.seekbox.ai` production env label and CORS origins.
6. Add DNS and Netlify domain config for `x.seekbox.ai`.
7. Confirm `seekbox.ai` maps to the intended main web app and not an older deploy.

### Phase 2: Domain Cutover

1. `seekbox.ai`
   - Use `seekbox-main-react` as the deploy candidate.
   - Set `VITE_SEEKBOX_API_URL=https://api.seekbox.ai`.
   - Keep `/v1/*` redirects as compatibility, but prefer direct API client configuration.
   - Ensure Supabase Auth redirect URLs include `https://seekbox.ai`.

2. `x.seekbox.ai`
   - Use `xdotseekboxai`.
   - Add Netlify custom domain.
   - Redirect or canonicalize `x.seekboxai.com` after the new domain is verified.
   - Ensure public pages read only public-safe views/endpoints.
   - Keep cost/admin surfaces behind admin-only routes or separate admin app.

3. `api.seekbox.ai`
   - Flip `env` from canary to production if appropriate.
   - Enforce or at least alert on missing `X-App`.
   - Tighten CORS to known origins once all apps are configured.
   - Keep compatibility aliases for old frontend paths during transition.

### Phase 3: Unify Product Systems

1. Move reusable main search improvements from `seekbox-main-react` into xdot CleanSeek X where they fit.
2. Replace ad hoc Pulse heat/rising voice formulas with stored/public metrics where available.
3. Use `public_pulse_voice_rankings` as the source of truth for voices and drilldowns.
4. Promote `Core Candidate Ranking` into a shared pipeline for search, Pulse, StarsAlign, and future verticals.
5. Move cost observability fully into `sbx-ops-admin` or an authenticated admin route, not public product pages.

## Open Risks

| Risk | Why it matters | Recommended handling |
| --- | --- | --- |
| `api.seekbox.ai` reports `env: "canary"` | Confusing and risky for production operations | Fix Worker env/config or document intentional aliasing |
| `x.seekbox.ai` does not resolve | Blocks canonical X/Pulse launch | Add DNS + Netlify custom domain |
| Cost/provider metadata leakage | User-facing trust and business risk | Keep stripping/gating, test all public routes |
| Multiple dirty working trees | Easy to lose work or merge wrong pieces | Branch and commit by concern before more deploy work |
| API doc drift | Frontends can call stale routes or miss new routes | Maintain `V1-API-v1.8` as part of release process |
| Local docs containing secrets | GitHub/public exposure risk | Scrub docs, rotate exposed keys/tokens |
| Legacy `ruffled-snail` references | Confusing ownership and observability | Keep temporary aliases, migrate to `api.seekbox.ai` |
| Direct Supabase raw table reads | Can expose private run data over time | Move browsers to public views and owner-scoped RLS |
| Admin app role simulation | Useful locally, unsafe publicly | Keep `sbx-ops-admin` private and behind real auth |

## Recommended GitHub Cleanup Shape

Use separate branches/PRs:

1. `public-safety-cleanup`
   - Cost stripping.
   - Public Pulse views.
   - X Intel metadata sanitization.
   - Build/test verification.

2. `domain-cutover`
   - Netlify domain docs/config.
   - `VITE_SEEKBOX_API_URL` standardization.
   - `x.seekbox.ai` readiness.

3. `api-docs-v1.8`
   - Reconcile v1.7 with live music/enrichment routes.
   - Add endpoint status labels: live, canary, admin-only, planned, deprecated.

4. `core-ranking`
   - `src/lib/rankingPipeline.ts`.
   - `supabase/core_candidate_ranking.sql`.
   - Public result view.
   - First UI integration after data contract is accepted.

5. `main-search-port`
   - Pull only the proven main search improvements from `seekbox-main-react`.
   - Apply to `xdotseekboxai` CleanSeek X without dragging legacy app state.

## Release Gates For The Three-Domain Plan

Before calling this production-stable:

- `https://api.seekbox.ai/health` returns production-labeled env.
- `https://seekbox.ai` serves the intended main app.
- `https://x.seekbox.ai` resolves and serves xdot.
- `x.seekboxai.com` has a clear redirect/canonical policy.
- Supabase Auth redirect URLs include all production domains.
- Netlify env vars are aligned across main and xdot.
- API docs include every live endpoint used by deployed frontends.
- Public route smoke tests confirm no cost, latency, provider metadata, raw prompt, raw payload, or admin token appears in user-facing responses.
- GitHub has one clean branch per concern and no local-only critical work.

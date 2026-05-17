# SeekBox Whales Edition

SeekBox Whales Edition is the ticker-page layer for Unusual Whales data. Current mode is strict BYOK:

- Users paste their own Unusual Whales API key in the browser.
- The key is sent only to the local `/api/unusual-whales` server route for the current request.
- The route forwards the key to `https://api.unusualwhales.com` using `Authorization: Bearer ...`.
- SeekBox does not write the key to Supabase.
- SeekBox does not write the key to local storage.
- The current UI purges the old localStorage key names from the earlier remember-key build.
- The field is a password-style input so Chrome may offer autofill/password-manager handling, but the app does not own or rely on that storage.
- Server-hosted shared key mode is disabled for now, even if `UW_API_KEY` exists in Netlify.
- The seeded board currently watches `OKE` (ONEOK), `AAPL`, `SPY`, and `VIX`.
- When the `uw_symbols` migration exists, the ticker page reads the seeded public watchlist from Supabase and falls back to the bundled four-symbol list if the table is missing.

## User-Facing Copy

Use "Connect your own Unusual Whales key" for the key prompt. Avoid copy that implies SeekBox includes, resells, or redistributes Unusual Whales data for general users.

- BYOK mode: the user supplies their own UW key and usage stays tied to their UW account.
- Do not mention hosted access in current user-facing copy.
- Do not offer a localStorage remember-key toggle.
- The page should continue to describe output as a research surface, not financial advice.

## License Posture

Unusual Whales' non-professional API acknowledgement says the API is for personal use and that redistribution, including derived data, can revoke access or terminate the subscription. For that reason:

- do not expose a shared hosted key to users
- do not store raw provider payloads
- keep stored snapshots private to the signed-in user with RLS
- prefer short retention windows and cleanup jobs
- use BYOK mode until the business/licensing posture changes

Source: https://storage.googleapis.com/uwassets/Unusual_Whales_Non-Professional_API_Acknowledgement.pdf

## Current Data Pull

The first ticker snapshot supports:

- `/api/stock/{ticker}/flow-recent`
- `/api/option-trades/flow-alerts`
- `/api/darkpool/{ticker}`
- `/api/market/market-tide` as an optional, extra call

The UI normalizes those responses into:

- options call/put premium balance
- flow alert count and largest alert
- dark pool total and largest print
- optional market tide sparkline
- an LLM-ready prompt that can be pushed into the ticker Pulse search box

## UW Lab Packs

The ticker page now has opt-in lab packs for deliberately over-sampling the API during personal/dev discovery. These calls run only when a BYOK user clicks `Run`; nothing auto-loads.

- Market impact: `/api/market/top-net-impact`, `/api/market/oi-change`, `/api/market/sector-etfs`, `/api/market/total-options-volume`
- Gamma/vol: `/api/stock/{ticker}/greek-exposure`, `/api/stock/{ticker}/iv-rank`, `/api/stock/{ticker}/max-pain`, `/api/stock/{ticker}/volatility/stats`, `/api/stock/{ticker}/volatility/term-structure`
- News catalyst: `/api/news/headlines`
- Ownership and short pressure: insider buy/sells, institutional ownership, short data, and failures-to-deliver endpoints
- Political tape: congressional unusual trades by ticker, when available for the subscription level
- ETF tide: `/api/market/{ticker}/etf-tide` plus market-tide comparison

The special thing about UW for SeekBox is not one endpoint. It is the ability to create a compact read that combines options pressure, market-wide impact, gamma/volatility context, dark-pool/short pressure, and public catalysts into a promptable research surface.

Source: https://api.unusualwhales.com/docs

## Supabase Isolation

Migration:

`supabase/migrations/20260510215000_create_unusual_whales_private_cache.sql`

The migration creates:

- `uw_symbols` for seeded/private symbol configuration
- `uw_snapshots` for user-owned normalized snapshot metadata and metrics
- `uw_snapshot_items` for user-owned normalized item summaries
- `uw_lab_runs` for user-owned normalized lab-pack metadata and metrics
- `uw_lab_items` for user-owned normalized lab-pack summaries
- `delete_expired_uw_snapshots()` for TTL cleanup

The tables are intentionally prefixed with `uw_` so they can be moved into a separate database later without renaming the domain model.

## Future Shared-Key Mode

If SeekBox later pays for a higher Unusual Whales tier, do not expose a shared key anonymously. Add:

- role or subscription gating before the request runs
- per-role quotas from the same role definitions/account summary logic
- request logging without storing API keys
- endpoint-level cost controls, especially around market tide and realtime/streaming data
- a provider setting such as `UNUSUAL_WHALES_SHARED_ENABLED=true` so shared-key mode is explicit

Until those controls exist, keep shared-key mode disabled.

# SeekBox Whales Edition

SeekBox Whales Edition is the ticker-page layer for Unusual Whales data. It supports two key modes:

- Hosted key mode: Netlify stores `UW_API_KEY`; signed-in SeekBox users can call `/api/unusual-whales` without pasting a key.
- BYO key mode: users paste their own Unusual Whales API key in the browser.
- A pasted key overrides the hosted key for that request.
- Any user-supplied key is sent only to the local `/api/unusual-whales` server route for that request.
- The route forwards the key to `https://api.unusualwhales.com` using `Authorization: Bearer ...`.
- SeekBox does not write the key to Supabase.
- If the user checks "Remember this key on this device", the browser stores it in local storage on that device only.
- Hosted key mode verifies the Supabase session token before using `UW_API_KEY`.
- Set `UW_ALLOWED_EMAILS=email1@example.com,email2@example.com` to limit hosted-key access further during personal/dev use.
- The seeded board currently watches `OKE` (ONEOK), `AAPL`, `SPY`, and `VIX`.

## License Posture

Unusual Whales' non-professional API acknowledgement says the API is for personal use and that redistribution, including derived data, can revoke access or terminate the subscription. For that reason:

- do not show hosted-key results to anonymous users
- do not expose a shared hosted key to general users
- do not store raw provider payloads
- keep stored snapshots private to the signed-in user with RLS
- prefer short retention windows and cleanup jobs
- use BYO key mode for anyone outside the approved personal/dev audience

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

## Supabase Isolation

Migration:

`supabase/migrations/20260510215000_create_unusual_whales_private_cache.sql`

The migration creates:

- `uw_symbols` for seeded/private symbol configuration
- `uw_snapshots` for user-owned normalized snapshot metadata and metrics
- `uw_snapshot_items` for user-owned normalized item summaries
- `delete_expired_uw_snapshots()` for TTL cleanup

The tables are intentionally prefixed with `uw_` so they can be moved into a separate database later without renaming the domain model.

## Future Shared-Key Mode

If SeekBox later pays for a higher Unusual Whales tier, do not expose a shared key anonymously. Add:

- role or subscription gating before the request runs
- per-role quotas from the same role definitions/account summary logic
- request logging without storing API keys
- endpoint-level cost controls, especially around market tide and realtime/streaming data
- a provider setting such as `UNUSUAL_WHALES_SHARED_ENABLED=true` so shared-key mode is explicit

Until those controls exist, keep hosted-key access signed-in and preferably email-limited.

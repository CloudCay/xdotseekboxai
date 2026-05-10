# SeekBox Personalization Seed

This is the first formal contract for personalization on the xdot site.

## Purpose

Users can have a lightweight personalization seed before the full persona system is moved into shared backend storage. The seed is explicit, user-editable, and safe to attach to searches.

## Inputs

- Account role from `accounts.role_id`, `accounts.role`, or `accounts.granted_role`
- Optional user profile note from the Account page
- Optional default lens from the Account page
- Optional per-search persona text from CleanSeek-X prompt modifiers
- The raw search query

## Levels

- `base`: anon, trial, free, standard, starter, power user
- `advisor`: trusted collaborator/advisor access
- `admin`: admin/operator access
- `superadmin`: superadmin or god/operator bypass access

Higher levels do not grant secret data by themselves. They only change the default framing:

- Advisor: implications, decisions, client-ready next steps
- Admin: settings, risks, ownership, operational next actions
- Superadmin: architecture, data contracts, debugging, economics, growth experiments

## History Classes

The frontend currently classifies searches locally so existing Supabase tables do not need a migration yet. The class is appended to `search_sessions.search_mode`.

Classes:

- `market_watch`
- `industry_pulse`
- `company_research`
- `competitive_intel`
- `technical_research`
- `customer_support`
- `creative_ideation`
- `personal_research`
- `general_research`

## Current Storage

Local device storage:

- `seekbox_personalization_seed_v1`

Future backend storage should move this to a user-owned personalization table and preserve this shape:

```ts
type PersonalizationSeed = {
  enabled: boolean
  profileNote: string
  preferredLens: string
  historyClassing: boolean
}
```

The prompt instruction must only use explicit user-provided data. Do not infer sensitive traits.

# Anonymous to Subscriber Flow

Snapshot date: 2026-05-18

This documents how an anonymous visitor becomes a signed-in and paid X.SeekBoxAI subscriber in the current xdot app.

## Executive Summary

There is no separate "sign up" page. The sign-up path is the same as sign-in:

- `/signin` creates or resumes a Supabase user through magic link, Google OAuth, or X OAuth.
- `ensureAccount()` creates or updates the `accounts` row after authentication.
- `/pricing` explains the paid plan and links to `/checkout`.
- `/account` shows profile/plan state and also links directly to `/checkout`.
- `/checkout` immediately creates a Stripe Checkout Session for signed-in users and redirects to Stripe.
- Stripe sends lifecycle events to `https://api.seekbox.ai/v1/payments/webhook`.
- The API webhook writes `user_subscriptions` and updates the account role/state.
- `/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}` polls briefly so the new subscription appears after checkout.

The surprising behavior is intentional in the current code: clicking `Start checkout` from `/account` sends a signed-in user straight through the Stripe handoff because `/checkout` is an auto-start route, not a plan-review page.

## Public Entry Points

| User state | Route or UI | What happens |
| --- | --- | --- |
| Anonymous | Header account badge | Shows `Anonymous` and links to `/signin?returnTo=<current-path>`. |
| Anonymous | `/signin` | User can create/resume an account with magic link, Google, or X. |
| Anonymous or signed-in | `/pricing` | Shows the current paid plan and links to `/checkout?plan=power-live-x-monthly`. |
| Anonymous | `/checkout` | Shows an error state with a sign-in link to `/signin?returnTo=/checkout`. |
| Signed-in | `/checkout` | Calls the server checkout function and redirects immediately to Stripe Checkout. |
| Signed-in | `/account` | Shows account state and a `Start checkout` button. |
| Post-payment | `/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}` | Polls for webhook-written subscription state and then strips the query params. |

## Current Paid Plan

The active pricing catalog is in `src/lib/pricingCatalog.ts`.

Current plan:

- ID: `power-live-x-monthly`
- Title: `X.SeekBoxAI + Live X`
- Tier: `Power tier`
- Display price: `$20.20 / month` by default
- Default price ID:
  - `VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY` if set
  - otherwise `price_1TTf7OAghz6CNDMAjyhVsGkZ`
  - if `VITE_STRIPE_PRICESET=test_current`, `price_1TTWUTAghz6CNDMATSskXYmY`

## Route Details

### `/signin`

File: `src/routes/signin.tsx`

Purpose:

- This is both sign-in and sign-up.
- Reads `returnTo` from the query string.
- Sends magic links with `shouldCreateUser: true`.
- Supports Google and X OAuth.
- Uses Turnstile when configured.
- After Supabase auth succeeds, redirects back to `returnTo`.

Important behavior:

- If a user does not exist yet, Supabase can create one during magic-link/OAuth auth.
- There is no separate "create account" form before Stripe.
- `returnTo` should be a safe relative path, e.g. `/checkout`, `/pricing`, `/cleanseek-x`.

### `ensureAccount()`

File: `src/lib/ensureAccount.ts`

Purpose:

- Calls the Supabase `ensure_account` RPC.
- Creates or updates the app-level account row after Supabase auth.
- Signed-in users enter as `trial` by default.
- Anonymous rows remain `anon`.

Where it runs:

- Header account badge refresh.
- `/account` load.
- `/checkout` before Stripe session creation.
- Search/profile summary hydration paths.

### `/pricing`

File: `src/routes/pricing.tsx`

Purpose:

- Shows the single current paid plan.
- CTA: `Start checkout`.
- Secondary CTA: `View account`.

Current behavior:

- `Start checkout` links directly to `/checkout?plan=power-live-x-monthly`.
- If the visitor is not signed in, `/checkout` will ask them to sign in.
- The page copy says: "You'll be asked to sign in before checkout."

### `/account`

File: `src/routes/account.tsx`

Purpose:

- Shows signed-in account email, Supabase user ID, account role, plan, and subscription status.
- Runs `ensureAccount()` before reading account/subscription state.
- Polls briefly after Stripe returns.

Current behavior:

- The top CTA is `Start checkout` for unpaid users.
- That CTA links directly to `/checkout`.
- For paid/trialing users, the label becomes `Manage / upgrade`, but it still links to `/checkout` today.

This is why the account page can feel like it "just sends me through Stripe." The `/account` CTA skips `/pricing` and enters the auto-start checkout route.

### `/checkout`

File: `src/routes/checkout.tsx`

Purpose:

- Requires a Supabase session.
- Ensures the account row exists.
- Creates a Stripe Checkout Session through `createCheckoutSession()`.
- Redirects to Stripe Checkout immediately.

Request payload sent to the payments API:

- `userId`
- `email`
- `priceId`
- `successUrl`
- `cancelUrl`
- `planId`

Success URL:

```text
<origin>/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}
```

Cancel URL:

```text
<origin>/cleanseek-x
```

### `createCheckoutSession()`

File: `src/server/stripe.functions.ts`

Purpose:

- TanStack Start server function.
- Posts checkout data to the canonical API:

```text
POST https://api.seekbox.ai/v1/payments/checkout-session
```

The API creates the Stripe Checkout Session and returns a Stripe-hosted checkout URL.

### Stripe Webhook

Canonical endpoint:

```text
https://api.seekbox.ai/v1/payments/webhook
```

Expected Stripe events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Compatibility aliases on the API:

- `/api/stripe/create-checkout-session`
- `/api/stripe/webhook`

The old VibeCode webhook should be disabled:

```text
https://ruffled-snail.vibecode.run/api/stripe/webhook
```

## End-to-End Funnel

### Path A: Anonymous visitor chooses pricing first

1. Visitor opens `/pricing`.
2. Visitor clicks `Start checkout`.
3. App opens `/checkout?plan=power-live-x-monthly`.
4. If no Supabase session exists, `/checkout` shows "Please sign in first."
5. Visitor clicks `Sign in`.
6. App opens `/signin?returnTo=/checkout`.
7. Visitor signs in or signs up through magic link/OAuth.
8. `/signin` redirects back to `/checkout`.
9. `/checkout` runs `ensureAccount()`.
10. `/checkout` creates a Stripe Checkout Session.
11. Browser redirects to Stripe.
12. Stripe payment completes.
13. Stripe sends `checkout.session.completed` to `/v1/payments/webhook`.
14. Stripe redirects browser to `/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}`.
15. `/account` polls briefly until the subscription row appears.

### Path B: Anonymous visitor signs in first

1. Visitor clicks the header `Sign in` badge from any route.
2. App opens `/signin?returnTo=<current-path>`.
3. Visitor authenticates.
4. `ensureAccount()` creates/updates the account on the next account-aware surface.
5. Visitor opens `/pricing` or `/account`.
6. Visitor clicks `Start checkout`.
7. `/checkout` redirects directly to Stripe.
8. Webhook/account confirmation follows the same flow as Path A.

### Path C: Signed-in trial user upgrades from account

1. User opens `/account`.
2. User clicks `Start checkout`.
3. App opens `/checkout`.
4. `/checkout` auto-starts Stripe Checkout.
5. Webhook/account confirmation follows the same flow as Path A.

## What May Need Product Cleanup

Current behavior works, but the UX can be clearer:

1. Rename `/account` CTA from `Start checkout` to `View pricing` when the user is unpaid, and send it to `/pricing`.
2. Add a secondary `Start checkout` button on `/pricing` as the explicit Stripe handoff.
3. Make `/checkout` say "Preparing secure Stripe checkout..." so users understand it is an auto-redirect route.
4. Add a signed-out `/account` state that links to `/signin?returnTo=/account` instead of only showing "Not signed in."
5. Add "Create free account" copy to `/signin`, since that route is also sign-up.

## Operational Checklist

For a healthy anon-to-paid funnel:

- Supabase env vars are set on Netlify:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Turnstile env vars are set if captcha is required:
  - `VITE_TURNSTILE_SITE_KEY`
  - `VITE_AUTH_TURNSTILE_ENABLED`
- Stripe price env is correct:
  - `VITE_STRIPE_PRICE_POWER_LIVE_X_MONTHLY`
- Payments API points to the canonical Worker:
  - default `https://api.seekbox.ai`
  - optional override `VITE_PAYMENTS_API_URL`
- Stripe webhook endpoint is:
  - `https://api.seekbox.ai/v1/payments/webhook`
- Stripe webhook signing secret in Cloudflare Worker matches the active Stripe destination.
- Old duplicate webhook destinations are disabled.

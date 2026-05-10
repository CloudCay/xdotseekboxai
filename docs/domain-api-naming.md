# SeekBox Domain and API Naming

Date: 2026-05-10

This note captures the working naming convention for SeekBox domains, APIs, provider services, and staging/production routing.

## Core Naming

- **SeekBox API**: the user-facing name for your own API.
- **SeekBox Core API**: a more precise internal name for the API that owns account, search, pulse, billing, and notification orchestration.
- **SeekBox API Gateway**: the Cloudflare Workers entry point that receives browser/app requests and routes them to internal code or external providers.
- **Provider APIs**: third-party APIs behind the SeekBox API, such as Twilio, Stripe, Supabase, Brevo, OpenAI, xAI, Anthropic, Google, and Brave.
- **Connectors**: your own wrappers around provider APIs. Example: `twilioConnector`, `stripeConnector`, `xaiConnector`.
- **Pulse API**: the X/Grok/live-signal data product if it becomes its own bounded API area.

## Domain Roles

- `seekbox.ai`: future canonical brand and production domain.
- `app.seekbox.ai`: optional main signed-in app domain if the app is separated from the marketing/home domain.
- `api.seekbox.ai`: production SeekBox API / Cloudflare Workers API gateway.
- `x.seekbox.ai`: future canonical domain for the Grok/X-focused Pulse product.
- `seekboxai.com`: current live staging/transition domain.
- `x.seekboxai.com`: current Grok/X-focused staging/product surface.
- `seekboxapp.com`: useful for mobile app links, deep links, redirects, and app-store style routing.

## Recommended Staging Shape

Use staging domains while DNS, Workers, Netlify, and Supabase Auth redirects are still moving:

- `seekboxai.com`: staging frontend.
- `x.seekboxai.com`: staging X/Pulse frontend.
- `api-staging.seekboxai.com`: staging Cloudflare Workers API.

Keep the API paths stable so production is a domain swap, not an app rewrite:

- `https://api-staging.seekboxai.com/v1/search`
- `https://api-staging.seekboxai.com/v1/account`
- `https://api-staging.seekboxai.com/v1/pulse`
- `https://api-staging.seekboxai.com/v1/notifications`
- `https://api-staging.seekboxai.com/v1/billing`

Production can later use the same paths:

- `https://api.seekbox.ai/v1/search`
- `https://api.seekbox.ai/v1/account`
- `https://api.seekbox.ai/v1/pulse`
- `https://api.seekbox.ai/v1/notifications`
- `https://api.seekbox.ai/v1/billing`

## Browser/App Rule

The browser should mostly know only the SeekBox API:

```text
Browser/App -> SeekBox API -> Provider APIs
```

Do not call provider APIs directly from the browser when secrets, rate limits, logs, or permissions matter.

Examples:

- Browser calls `POST /v1/notifications/sms`; SeekBox API calls Twilio.
- Browser calls `POST /v1/billing/checkout`; SeekBox API calls Stripe.
- Browser calls `POST /v1/search`; SeekBox API calls OpenAI, xAI, Anthropic, Brave, etc.
- Browser calls `POST /v1/account/ensure`; SeekBox API coordinates Supabase/account state.

## Provider API Labels

- **Supabase**: auth, database, account records, role definitions, magic-link session handling.
- **Brevo SMTP**: transactional email delivery.
- **Stripe**: billing, checkout, subscription state, webhooks.
- **Cloudflare Workers**: SeekBox API gateway and backend runtime.
- **Twilio**: SMS, phone verification, WhatsApp, voice, notification workflows.
- **OpenAI/xAI/Anthropic/Google/Brave/etc.**: LLM, search, live web, and analysis providers.

## API Area Names

Suggested route groups:

- `/v1/search`: multi-engine search, cleanseek, streaming, result creation.
- `/v1/account`: account creation, role resolution, profile summary, trial state.
- `/v1/auth`: auth-adjacent backend helpers if needed, but keep Supabase Auth as the identity provider.
- `/v1/pulse`: X/Pulse cache, industry highlights, trending, charts, summaries.
- `/v1/notifications`: Twilio SMS, email notification orchestration, report-ready alerts.
- `/v1/billing`: Stripe checkout, customer portal, plan sync, subscription webhooks.
- `/v1/admin`: operator-only tools.

## Naming Preference

Use product-neutral internal names where possible:

- Good: `SeekBox API`, `Provider APIs`, `Connectors`, `Pulse API`
- Avoid: making Twilio, Stripe, or xAI sound like the primary user-facing API

The user-facing story is:

```text
SeekBox talks to many providers for you.
```

The engineering story is:

```text
The browser talks to the SeekBox API. The SeekBox API owns policy, secrets, roles, logging, cost controls, and provider routing.
```

## Current Recommendation

For now:

1. Keep `seekboxai.com` and `x.seekboxai.com` as live staging/transition surfaces.
2. Put the new Cloudflare Workers backend on `api-staging.seekboxai.com`.
3. Keep `seekbox.ai` as the future canonical production domain.
4. Later move production to `api.seekbox.ai`, `app.seekbox.ai`, and `x.seekbox.ai`.
5. Treat Twilio as a provider API behind `/v1/notifications`, not a separate browser-facing app API.

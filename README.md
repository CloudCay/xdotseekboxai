# SeekBoxAi

The Ultimate Multi-AI Search & Analyst Platform.

## Overview

SeekBoxAi allows you to compare answers from 10+ top AI models instantly, including GPT-4o, Claude Sonnet 4, Gemini 2.5 Flash, and Grok-4. The platform features real-time X data, trends, and live verification directly integrated into the search results.

## Key Technologies

- **Framework**: TanStack Start
- **Frontend**: React 19, TanStack Router
- **Build**: Vite 7
- **Styling**: Tailwind CSS 4
- **Deployment**: Netlify

## Getting Started

To run the application locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   Or use the Netlify CLI to emulate the Netlify platform locally:
   ```bash
   npx netlify dev
   ```

3. Open your browser and navigate to `http://localhost:8888` (or the port specified by Vite/Netlify dev).

## Netlify environment variables

Set these in Netlify (**Site configuration → Environment variables**):

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_BACKEND_URL` | SeekBox API base URL (e.g. `https://ruffled-snail.vibecode.run`). Used by server functions for `/api/accounts/upsert` and Stripe checkout. |
| `EXPO_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site key** (public). Same name as SeekBox so you can reuse one variable across sites. When unset, the Turnstile widget is skipped. |
| `TWELVE_DATA_API_KEY` | Server-only Twelve Data key for the `/ticker` quote panel. `TWELVE_API_KEY` is also supported for older environments. |

**Turnstile hostname allowlist:** in the Cloudflare Turnstile widget settings, add every hostname users will load checkout from (e.g. `localhost`, `seekboxai-dev.netlify.app`, `x.seekboxai.com`).

**Note:** Server-side verification (secret key) happens on the SeekBox backend when it accepts `turnstile_token`; the widget alone only collects the token client-side.

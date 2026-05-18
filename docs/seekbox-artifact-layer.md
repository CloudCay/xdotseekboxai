# SeekBox Artifact Layer

Date: 2026-05-17
Status: Product and technical blueprint
Related docs: `docs/seekbox-stack-snapshot-2026-05-17.md`, `docs/pulse-voice-ranking.md`, `docs/seekbox-candidate-ranking-core.md`, `docs/x-intel-compliance.md`

## Why This Exists

The current pain is not that SeekBox lacks outputs. It has many outputs:

- CleanSeek search sessions.
- Per-engine answers.
- Pulse briefs.
- Topic pages.
- Voice profiles.
- X Intel lab outputs.
- Second-opinion reads.
- XMarks presets and user picks.
- Candidate rankings.
- API docs, stack snapshots, handoff docs, recovery notes.

The pain is that these outputs are scattered across chat logs, local files, Supabase tables, Git branches, browser state, and deployed apps. They are often useful, but not always durable, linkable, versioned, cited, or reusable.

The SeekBox Artifact Layer should make the durable object the center of the product.

```text
Search / Agent run / Pulse cron / Upload / Admin action
  -> creates one or more Artifacts
  -> each Artifact has sources, citations, provenance, visibility, versions, and links
  -> users and agents can reopen, compare, extend, cite, export, or publish it
```

Artyfacts.ai is a useful category signal: agent work is moving from disposable chat toward persistent workspaces. SeekBox should not copy that generic framing. SeekBox's angle is a cited, multi-model intelligence workspace where every artifact knows what produced it, what evidence supports it, what changed, and whether it is safe to expose.

## Product Definition

An artifact is a durable SeekBox object created by a human, model, agent, cron job, API call, upload, or ranking pipeline.

It is not just a file. It is a structured record with:

- A type.
- A title and summary.
- A body or payload.
- Sources and citations.
- Provenance.
- Ownership.
- Visibility.
- Version history.
- Relationships to other artifacts.
- A public-safe projection when needed.

The promise:

> Ask once, research once, run once, or discover once, and the useful result becomes something you can keep working with.

## What SeekBox Artifacts Are

| Artifact type | Example | Owner surface | Public-safe? |
| --- | --- | --- | --- |
| `search_session` | A CleanSeek multi-engine run for "Tulsa business" | `seekbox.ai`, `x.seekbox.ai` | User-owned by default |
| `engine_answer` | Claude/Grok/Tavily/Brave answer inside a session | API + frontend | Only after stripping provider internals |
| `research_brief` | Synthesized executive brief from multiple answers | Main search, Rabbithole, CleanSeek X | Usually user-owned |
| `pulse_brief` | Daily industry/ticker/topic X brief | X/Pulse | Public via safe views |
| `voice_profile` | Durable profile for a cited X voice | X/Pulse | Public summary only |
| `topic_digest` | Topic page generated from pulse runs and citations | X/Pulse | Public summary only |
| `source_bundle` | Set of URLs/citations used in a run | All surfaces | Public if URLs are allowed |
| `candidate_ranking` | Ranked candidate set from X/web/music/market data | Core ranking | Public safe view only |
| `second_opinion` | Browser extension read of a page or selected text | Extension/account | User-owned |
| `prompt_seed` | Saved search/pulse prompt template | Seeds/XMarks | Public or user-owned |
| `uploaded_file` | PDF/image/document in library | Main account/library | User-owned |
| `api_snapshot` | Versioned API contract or endpoint verification | Admin/docs | Internal or public docs |
| `stack_snapshot` | Technical state doc like this week's cleanup snapshot | Admin/docs | Internal first |
| `release_snapshot` | Branch/deploy/test status at a point in time | GitHub/Netlify/admin | Internal |
| `integration_run` | Spotify/Soundcharts/Ticketmaster enrichment pass | Sub-app/API | Internal with public summaries |

## What SeekBox Artifacts Are Not

Artifacts should not become a dumping ground for secrets or raw traces.

Do not store in public artifact projections:

- Provider API keys.
- Admin tokens.
- Raw prompts that include private context.
- Full provider responses.
- Full raw post dumps.
- Tool traces.
- Cost, latency, token usage, or billing metadata.
- Private account or user metadata.
- Unredacted uploaded document text unless user-owned and access-controlled.

Those belong in private run logs with retention rules and strict access.

## Conceptual Data Model

The current codebase already has several artifact-like tables. The goal is not to delete them. The goal is to add a small common layer that can point to them and normalize library behavior.

### Core Tables

```sql
artifacts
  id uuid primary key
  workspace_id uuid null
  user_id uuid null
  tenant_id uuid null
  artifact_type text not null
  source_app text not null
  source_feature text null
  source_route text null
  title text not null
  summary text null
  body_markdown text null
  body_json jsonb not null default '{}'
  status text not null default 'ready'
  visibility text not null default 'private'
  safe_public boolean not null default false
  canonical_url text null
  source_table text null
  source_record_id text null
  created_by_kind text not null default 'human'
  created_by_label text null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()

artifact_sources
  id uuid primary key
  artifact_id uuid references artifacts(id) on delete cascade
  source_kind text not null
  title text null
  url text null
  domain text null
  published_at timestamptz null
  snippet text null
  source_ref text null
  safe_public boolean not null default false

artifact_citations
  id uuid primary key
  artifact_id uuid references artifacts(id) on delete cascade
  source_id uuid references artifact_sources(id) on delete set null
  marker text null
  label text null
  url text null
  excerpt text null
  position int null
  safe_public boolean not null default false

artifact_versions
  id uuid primary key
  artifact_id uuid references artifacts(id) on delete cascade
  version_number int not null
  title text not null
  summary text null
  body_markdown text null
  body_json jsonb not null default '{}'
  change_note text null
  created_by_kind text not null
  created_at timestamptz not null default now()

artifact_links
  id uuid primary key
  from_artifact_id uuid references artifacts(id) on delete cascade
  to_artifact_id uuid references artifacts(id) on delete cascade
  relation text not null
  created_at timestamptz not null default now()

artifact_events
  id uuid primary key
  artifact_id uuid references artifacts(id) on delete cascade
  event_type text not null
  actor_kind text not null
  actor_id text null
  event_json jsonb not null default '{}'
  created_at timestamptz not null default now()
```

### Private Run Logs Stay Separate

Keep these private or owner/admin scoped:

- `api_calls`
- `pulse_runs`
- `research_runs`
- `rabbithole_runs`
- `rabbithole_stages`
- `rabbithole_messages`
- image generation internals
- provider payload caches
- cost tables
- admin snapshots

The artifact can point at a private run with `source_table` and `source_record_id`, but the public artifact should not inline private run fields.

### Public Views

Public readers should never select directly from the private artifact table unless every column is safe.

Preferred pattern:

```sql
public_artifacts
public_artifact_sources
public_artifact_citations
```

These views should:

- Include only `safe_public = true`.
- Strip private provenance fields.
- Include allowed source URLs only.
- Hide user/account identifiers unless intentionally public.
- Hide model/provider/cost/timing by default.

## Provenance Model

Each artifact should answer:

1. Where did this come from?
2. Which app/surface created it?
3. Which run created it?
4. Which sources/citations support it?
5. Which model or agent created it?
6. Has it changed since creation?
7. Is this safe to publish?

Recommended provenance shape inside `body_json.provenance` or a separate private table:

```ts
type ArtifactProvenance = {
  sourceApp: string
  sourceFeature?: string
  sourceRoute?: string
  operationId?: string
  searchRunId?: string
  privateRunRef?: {
    table: string
    id: string
  }
  createdBy: {
    kind: 'human' | 'model' | 'agent' | 'cron' | 'api' | 'import'
    label?: string
  }
  modelRefs?: Array<{
    provider?: string
    model?: string
    role?: string
  }>
  sourceCounts?: {
    citations?: number
    urls?: number
    documents?: number
  }
  safety: {
    publicSafe: boolean
    reviewedBy?: string
    reviewedAt?: string
    notes?: string
  }
}
```

For public artifact views, expose only safe portions:

- `sourceApp`
- `sourceFeature`
- `createdBy.kind`
- source/citation counts
- public safety status if useful

Do not expose provider/model/cost internals unless the artifact is admin-only.

## How Existing Systems Map In

### CleanSeek X

Current pieces:

- `search_sessions`
- `engine_results`
- local result snapshots
- parsed citations
- source rails
- prompt modifiers

Artifact mapping:

- One `search_session` artifact per saved run.
- One `engine_answer` child artifact per model/source result.
- One `source_bundle` artifact per run if citations or search results are meaningful.
- Optional `research_brief` artifact when synthesis is created.

Near-term UI:

- "Save to Library" becomes "Save Artifact".
- History becomes one artifact view filtered to `search_session`.
- Citation rail should point to artifact sources/citations.

### Pulse

Current pieces:

- private `pulse_runs`
- `public_pulse_runs`
- `pulse_voice_rankings`
- `public_pulse_voice_rankings`
- topic pages
- voice pages
- pulse metric WIP

Artifact mapping:

- `pulse_brief` artifact for each public-safe pulse run.
- `voice_profile` artifact for each durable handle/scope profile.
- `topic_digest` artifact for topic/tag pages.
- `source_bundle` artifact for public-safe citations.

Near-term UI:

- Every Pulse brief gets a stable artifact URL.
- Topic and voice pages show which artifacts cite/support them.
- Heat and rising voices should derive from stored public metrics where possible, not ad hoc capped display values.

### X Intel Labs

Current pieces:

- `/api/x-intel/x-battle`
- `/api/x-intel/post-room`
- `/api/x-intel/anti-echo`
- Matrix lab
- gateway stats/cost WIP

Artifact mapping:

- `x_intel_report` artifact for each completed lab run.
- `source_bundle` artifact for X/Twitter links.
- Private run link to gateway call details.

Safety:

- Public report may include summaries, themes, counters, scores, allowed URLs.
- Private run may include raw provider details, but never public payload.
- Cost panels stay admin-only.

### Second Opinions

Current table:

- `seekbox_second_opinions`

Artifact mapping:

- One `second_opinion` artifact per saved extension read.
- Sources include canonical URL, selected text source, and model responses.
- User-owned by default.

### XMarks And Seeds

Current tables:

- `xmarks_presets`
- `xmarks_user_picks`
- seed collections in code

Artifact mapping:

- `prompt_seed` artifacts for reusable prompts.
- `collection` artifacts for groups of seeds.
- Link prompt seeds to output artifacts they generated.

### Main SeekBox Library And Uploads

Current pieces in `seekbox-main-react`:

- `library_files`
- upload handoff to `/v1/files/*`
- search history
- shared sessions

Artifact mapping:

- Uploaded files become `uploaded_file` artifacts.
- Search runs become `search_session` artifacts.
- Shared sessions become `artifact_share` records, not ad hoc links.

## Domain Responsibilities

### `seekbox.ai`

Owns the human-facing library:

- My artifacts.
- Search history.
- Uploaded files.
- Shared sessions.
- Account-owned research briefs.
- Exports.
- Main search artifact creation.

### `x.seekbox.ai`

Owns X/Pulse intelligence artifacts:

- Pulse briefs.
- Topic digests.
- Voice profiles.
- X Intel reports.
- XMarks and seed artifacts.
- Public-safe citation/source views.

### `api.seekbox.ai`

Owns artifact creation policy and private provenance:

- Create artifact after search/chat/pulse/research/image/file/music runs.
- Attach source and citation records.
- Attach private run references.
- Enforce `X-App` and `X-Feature`.
- Produce public-safe projections.
- Keep cost/provider metadata internal.

## UI Concepts

### Artifact Library

The library should be filterable by:

- Type.
- App/surface.
- Topic/tag.
- Source domain.
- Date.
- Visibility.
- Owner/user/workspace.
- Has citations.
- Has unresolved review.

Important first tabs:

- Search sessions.
- Briefs.
- Pulse.
- Sources.
- Uploads.
- Seeds.
- Snapshots.

### Artifact Detail Page

Every artifact should have a canonical detail layout:

- Title.
- Summary.
- Artifact type.
- Created date.
- Source app/feature.
- Visibility badge.
- Body.
- Citations/sources.
- Related artifacts.
- Version history.
- Actions.

Actions:

- Re-run.
- Extend.
- Compare.
- Export markdown.
- Copy citation.
- Share.
- Publish/unpublish if allowed.
- Send to CleanSeek.
- Send to Pulse/topic page where relevant.

### Source Cards

Move away from bare `[x]` links when space allows.

A source card should show:

- Marker.
- Domain or platform.
- Title or handle.
- URL.
- Snippet/excerpt.
- Used by which section.
- Open source action.

Compact answer cards can still show `[1]`, but expanded artifact views should expose richer source context.

## API Contract Sketch

The API should eventually own artifact writes, even if the first implementation writes from frontends.

```text
POST /v1/artifacts
GET  /v1/artifacts
GET  /v1/artifacts/:id
PATCH /v1/artifacts/:id
POST /v1/artifacts/:id/sources
POST /v1/artifacts/:id/citations
POST /v1/artifacts/:id/versions
POST /v1/artifacts/:id/share
POST /v1/artifacts/:id/publish
POST /v1/artifacts/:id/unpublish
```

Minimum `POST /v1/artifacts` request:

```json
{
  "artifact_type": "search_session",
  "source_app": "x-seekboxai",
  "source_feature": "cleanseek-x",
  "title": "Tulsa business",
  "summary": "Multi-engine research session about Tulsa business climate.",
  "body_markdown": "...",
  "body_json": {},
  "visibility": "private",
  "source_table": "search_sessions",
  "source_record_id": "uuid"
}
```

Minimum response:

```json
{
  "id": "uuid",
  "artifact_type": "search_session",
  "title": "Tulsa business",
  "canonical_url": "https://seekbox.ai/artifacts/uuid",
  "visibility": "private",
  "safe_public": false,
  "created_at": "2026-05-17T00:00:00.000Z"
}
```

## Security And Governance

Visibility states:

- `private`: visible only to owner.
- `workspace`: visible to workspace/team members.
- `shared_link`: visible to tokenized share link holders.
- `public`: visible to everyone through public-safe views.
- `admin`: visible only in operator/admin surfaces.

Required gates:

- Public artifacts must be generated from public-safe views or pass a sanitizer.
- Admin artifacts must not be link-shareable without explicit export flow.
- Source URLs must be validated by allowed schemes and domains.
- X/Twitter-derived artifacts should store links, IDs, summaries, and counts rather than raw bulk post text.
- Uploaded files need owner-scoped RLS and expiring signed URLs.
- Cost and provider metadata stays in private runs/admin.

Audit events:

- create
- update
- version
- publish
- unpublish
- share
- export
- delete
- source_added
- citation_added
- rerun_started
- rerun_completed

## Implementation Plan

### Step 1: Name The Existing Objects

Add an internal `ArtifactLike` TypeScript type and map current records into it without changing storage yet.

Candidate files:

- `src/lib/artifacts.ts`
- `src/components/ArtifactCard.tsx`
- `src/components/ArtifactSourceList.tsx`

Start with:

- CleanSeek history row -> `search_session`.
- Pulse row -> `pulse_brief`.
- Voice ranking row -> `voice_profile`.
- Second opinion row -> `second_opinion`.

### Step 2: Add Rich Source UI

Use the artifact source model to improve citations:

- Keep compact markers in answer text.
- Add expanded source cards in side rails or detail views.
- Show domain/handle/title/snippet, not just `[x]`.

This is a visible product win before database migration.

### Step 3: Create Supabase Artifact Tables

Add `supabase/artifacts.sql` with:

- `artifacts`
- `artifact_sources`
- `artifact_citations`
- `artifact_versions`
- `artifact_links`
- `artifact_events`
- `public_artifacts`

Keep it additive. Do not disturb current production tables.

### Step 4: First Real Writer

Pick one writer:

- CleanSeek X save/history path, or
- Pulse cron writer on the API side.

Recommended first writer: CleanSeek X saved search, because it solves an obvious user pain and makes "library" concrete.

### Step 5: API-Owned Artifact Creation

Move writes behind `api.seekbox.ai`:

- Search API creates artifacts when requested.
- Pulse cron creates public-safe artifacts after each completed run.
- Research pipeline creates `research_brief` and child artifacts.

### Step 6: Artifact Library Page

For `seekbox.ai`:

- `/library` or `/artifacts`.
- Filters by type/app/source/date.
- Opens artifact detail.

For `x.seekbox.ai`:

- `/artifacts` can start as internal/beta.
- Public artifacts continue to appear through Pulse, topics, voices, industries.

## First Migration Candidate

The first useful database object can be small:

```sql
create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  artifact_type text not null,
  source_app text not null,
  source_feature text,
  title text not null,
  summary text,
  body_markdown text,
  body_json jsonb not null default '{}'::jsonb,
  visibility text not null default 'private',
  safe_public boolean not null default false,
  source_table text,
  source_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.artifacts enable row level security;

create policy artifacts_select_own
on public.artifacts
for select
to authenticated
using (auth.uid() = user_id);

create policy artifacts_insert_own
on public.artifacts
for insert
to authenticated
with check (auth.uid() = user_id);
```

Then grow sources/citations once the first writer is stable.

## Product Positioning

Do not position this as "chat history."

Better framing:

- "Your research library."
- "Every run becomes a reusable asset."
- "Cited work that survives the chat."
- "Keep the brief, sources, and reasoning trail together."
- "A workspace for humans and agents, grounded in sources."

SeekBox's unique angle:

- Multi-model by default.
- Search and citation native.
- Public/private views by design.
- Provider and cost governance through `api.seekbox.ai`.
- Domain products like Pulse and StarsAlign can reuse the same artifact core.

## What To Build Next

Immediate:

1. Add the artifact layer doc to the cleanup branch.
2. Create a tiny `src/lib/artifacts.ts` adapter for current CleanSeek history and Pulse rows.
3. Improve citation display using source cards in CleanSeek X detail/expanded mode.
4. Draft `supabase/artifacts.sql` but do not deploy it until RLS is reviewed.

Near-term:

1. Add `/artifacts` or fold it into `/account` as "Research library."
2. Let users save a CleanSeek run as an artifact.
3. Link Pulse/Voice/Topic pages to supporting artifacts.
4. Add artifact export to markdown.
5. Add artifact share links with clear public-safe projections.

Later:

1. API-owned artifact writes.
2. Agent workspaces with recurring tasks and review queues.
3. Artifact diffs between runs.
4. Artifact graph: which sources, voices, topics, and prompts created which outputs.
5. Admin artifact audit and cost attribution in `sbx-ops-admin`.

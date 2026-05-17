export type RoadmapStage = 'live' | 'building' | 'planned' | 'exploring'
export type RoadmapAccess = 'core' | 'premium'

export type RoadmapFeature = {
  id: string
  title: string
  stage: RoadmapStage
  access: RoadmapAccess
  area: string
  surface: string
  summary: string
  next: string
  seedVotes: number
  complianceNote?: string
  relatedPrompt?: string
}

export type ShowcasePrompt = {
  text: string
  featured?: boolean
  hint?: string
}

export type RoadmapIntegrationPlatform = {
  id: string
  name: string
  signal: string
  bestFor: string
  complianceNote: string
  coreIdeas: string[]
  premiumIdeas: string[]
}

export const ROADMAP_FEATURES: RoadmapFeature[] = [
  {
    id: 'anon-splash-gate',
    title: 'Anonymous splash and account gate',
    stage: 'building',
    access: 'core',
    area: 'Auth',
    surface: 'All product pages',
    summary: 'Give anonymous visitors a clear first screen with Google, magic link, and free account paths.',
    next: 'Decide which cached surfaces stay previewable and which actions require sign-in.',
    seedVotes: 18,
  },
  {
    id: 'public-feature-voting',
    title: 'Public roadmap voting',
    stage: 'building',
    access: 'core',
    area: 'Roadmap',
    surface: '/roadmap',
    summary: 'Let users vote on product ideas and leave a lightweight signal before we build heavier feedback loops.',
    next: 'Wire votes to Supabase once the public insert policy and aggregate view are ready.',
    seedVotes: 14,
  },
  {
    id: 'pulse-voice-ranking',
    title: 'Rising voices over time',
    stage: 'planned',
    access: 'core',
    area: 'Pulse',
    surface: 'Reader, industry pages',
    summary: 'Move from one-off handle lists to a durable ranking of discovered voices by industry and topic.',
    next: 'Persist first seen, last seen, citation count, novelty, and repeat mentions by scope.',
    seedVotes: 22,
  },
  {
    id: 'topic-drilldowns',
    title: 'Topic tag drilldowns',
    stage: 'planned',
    access: 'core',
    area: 'Pulse',
    surface: '/topics',
    summary: 'Make natural topic tags work like structured industries: drillable pages, source trails, and related runs.',
    next: 'Add topic-level summary, citations, and cross-links back to industries.',
    seedVotes: 17,
  },
  {
    id: 'x-login-provider',
    title: 'X sign-in provider',
    stage: 'exploring',
    access: 'core',
    area: 'Auth',
    surface: '/signin',
    summary: 'Add X as an optional identity provider after Google and magic link are stable.',
    next: 'Finish X Developer app setup and exact Supabase callback configuration.',
    seedVotes: 11,
  },
  {
    id: 'ticker-public-api',
    title: 'Ticker page with personal data APIs',
    stage: 'building',
    access: 'premium',
    area: 'Markets',
    surface: '/ticker',
    summary: 'Support personal market data keys while keeping the page useful with seeded tickers and public context.',
    next: 'Add Public.com personal API flow next to Unusual Whales BYOK.',
    seedVotes: 15,
    relatedPrompt: 'Current trader sentiment on NVDA stock plus key narratives on X',
  },
  {
    id: 'second-opinion-sync',
    title: 'Second Opinion account sync',
    stage: 'planned',
    access: 'premium',
    area: 'Extension',
    surface: '/second-opinion',
    summary: 'Turn the fast browser extension into account-aware saved second reads and synthesis history.',
    next: 'Sync extension reads to signed-in user history without exposing page text broadly.',
    seedVotes: 13,
  },
  {
    id: 'cleanseek-workbench-layouts',
    title: 'CleanSeek workbench layouts',
    stage: 'live',
    access: 'core',
    area: 'Search',
    surface: '/cleanseek-x',
    summary: 'Three-column desktop, sticky controls, model/search presets, and output formats tuned by source type.',
    next: 'Let users save workspace layouts per role or device.',
    seedVotes: 20,
  },
  {
    id: 'viral-pulse-briefs',
    title: 'Viral Pulse Briefs',
    stage: 'building',
    access: 'core',
    area: 'Pulse',
    surface: 'Reader, share pages',
    summary: 'Daily and hourly skimmable cards for hot topics with heat, novelty, dissent, highlights, and dissenting voices.',
    next: 'Make cards public, shareable, cache-first, and source-linked without raw bulk redistribution.',
    seedVotes: 27,
    complianceNote: 'Summaries and embedded previews, not downloadable raw post sets.',
    relatedPrompt: 'Read the room on Grok 4 reactions, heat, novelty, and dissent',
  },
  {
    id: 'industry-pulse-dashboards',
    title: 'Industry Pulse Dashboards',
    stage: 'live',
    access: 'core',
    area: 'Pulse',
    surface: '/industries',
    summary: 'Free pages for tech, finance, healthcare, politics, and other verticals with voices, clusters, and narrative shifts.',
    next: 'Keep industry verticals structured while letting topic clusters emerge naturally from current runs.',
    seedVotes: 24,
    complianceNote: 'Cache-first summaries with attribution and deletion-aware source trails.',
  },
  {
    id: 'read-the-room-widget',
    title: 'Read the Room widget',
    stage: 'planned',
    access: 'core',
    area: 'Distribution',
    surface: 'Embeds',
    summary: 'One-click embeddable topic pulse: paste a topic and get a brief public sentiment read.',
    next: 'Prototype a lightweight embed that returns only a brief and links back to X.SeekBoxAI.',
    seedVotes: 19,
    complianceNote: 'Brief-only embed; no raw data export.',
  },
  {
    id: 'anonymous-quick-search',
    title: 'Anonymous Quick Search',
    stage: 'building',
    access: 'core',
    area: 'Search',
    surface: '/cleanseek-x',
    summary: 'Let anonymous users try a small number of CleanSeek-X searches with limited models and basic live context.',
    next: 'Tighten anon limits by session actions, not just days, and make sign-in value obvious.',
    seedVotes: 25,
  },
  {
    id: 'novelty-dissent-alerts',
    title: 'Novelty and dissent alerts',
    stage: 'planned',
    access: 'core',
    area: 'Alerts',
    surface: 'Email, in-app',
    summary: 'Notify users when a topic has a sudden novelty jump or dissent spike.',
    next: 'Start with public in-app alerts, then decide which alert channels belong to paid tiers.',
    seedVotes: 21,
    complianceNote: 'Alert on derived signals and links, not copied post bodies.',
  },
  {
    id: 'education-research-mode',
    title: 'Educational research mode',
    stage: 'exploring',
    access: 'core',
    area: 'Research',
    surface: 'Research pages',
    summary: 'Academic and non-profit mode with basic analysis tools and source IDs for responsible research workflows.',
    next: 'Define a narrow, attribution-heavy research export that avoids raw corpus redistribution.',
    seedVotes: 12,
    complianceNote: 'Prefer post IDs, links, and summaries over full-text exports.',
  },
  {
    id: 'community-pulse-leaderboard',
    title: 'Community Pulse Leaderboard',
    stage: 'planned',
    access: 'core',
    area: 'Pulse',
    surface: 'Reader, industries, topics',
    summary: 'Gamified top voices, emerging accounts, heat maps, and narrative movers that people can share.',
    next: 'Rank by citations and emergence over time, not alphabetically.',
    seedVotes: 23,
  },
  {
    id: 'pro-cleanseek-x',
    title: 'Pro CleanSeek-X',
    stage: 'planned',
    access: 'premium',
    area: 'Search',
    surface: '/pricing, /cleanseek-x',
    summary: 'Paid tier with higher limits, full model toggles, synthesizer passes, personas, longer answers, and exportable briefs.',
    next: 'Price against unit economics and keep exports to summaries, PDFs, and citations rather than raw X post dumps.',
    seedVotes: 31,
    complianceNote: 'Bill for synthesis, workflow, and limits; not resale of raw X data.',
  },
  {
    id: 'enterprise-pulse-monitoring',
    title: 'Enterprise Pulse Monitoring',
    stage: 'planned',
    access: 'premium',
    area: 'Enterprise',
    surface: 'Team dashboards',
    summary: 'Custom topic dashboards, alert webhooks, team collaboration, historical synthesized cache, and branded reports.',
    next: 'Use approved data access for read-heavy customers and expose synthesized pulses instead of raw post corpora.',
    seedVotes: 29,
    complianceNote: 'Enterprise APIs should return derived intelligence, citations, and IDs by default.',
  },
  {
    id: 'x-agent-builder',
    title: 'X Agent Builder',
    stage: 'exploring',
    access: 'premium',
    area: 'Agents',
    surface: 'Intel workbenches',
    summary: 'No-code agents that monitor topics or accounts and generate daily briefings.',
    next: 'Build as monitoring and briefing only before considering any posting workflows.',
    seedVotes: 20,
    complianceNote: 'Avoid autonomous posting unless explicitly approved.',
  },
  {
    id: 'insight-reports-lite',
    title: 'Insight Reports Lite',
    stage: 'exploring',
    access: 'premium',
    area: 'Reports',
    surface: 'Reports, downloads',
    summary: 'Monthly synthesized industry pulse reports with aggregated insights and citations.',
    next: 'Define report templates that contain analysis, charts, and links, not full post collections.',
    seedVotes: 18,
    complianceNote: 'Sell analysis and aggregated insight, not full-text X datasets.',
  },
  {
    id: 'white-label-api-access',
    title: 'White-label pulse API',
    stage: 'exploring',
    access: 'premium',
    area: 'API',
    surface: 'api.seekbox.ai',
    summary: 'Let media teams, funds, and brands embed synthesized pulse intelligence in internal tools.',
    next: 'Create an internal API contract around summaries, scores, citations, and deletion-aware cache behavior.',
    seedVotes: 16,
    complianceNote: 'Default API shape should be synthesized pulses, not raw feed replication.',
  },
  {
    id: 'advanced-analytics-addons',
    title: 'Advanced analytics add-ons',
    stage: 'planned',
    access: 'premium',
    area: 'Analytics',
    surface: 'Dashboards',
    summary: 'Voice influence scoring, dissent risk forecasting, and cross-platform correlation across X, web, and news.',
    next: 'Start with voice influence over time because the pulse data model already points there.',
    seedVotes: 26,
  },
  {
    id: 'power-user-tools',
    title: 'Power user tools',
    stage: 'planned',
    access: 'premium',
    area: 'Workflow',
    surface: 'CleanSeek-X, Intel',
    summary: 'Bulk topic comparison, network graphs, sentiment trend exports, and Slack or Notion pulse delivery.',
    next: 'Prototype bulk topic comparison first because it reuses existing CleanSeek-X provider orchestration.',
    seedVotes: 22,
    complianceNote: 'Trend exports should be derived metrics and summaries, not raw post archives.',
  },
  {
    id: 'music-signal-fusion',
    title: 'Music signal fusion',
    stage: 'planned',
    access: 'core',
    area: 'Music',
    surface: 'Entertainment pulse',
    summary: 'Artist Pulse Cards and New Release Radar that combine X conversation heat with Spotify metadata and release context.',
    next: 'Start with public artist cards: X heat, Spotify popularity, new releases, top tracks, and clear attribution.',
    seedVotes: 24,
    complianceNote: 'Use non-streaming metadata and synthesized context; avoid redistribution or raw catalog resale.',
    relatedPrompt: 'Artist pulse for Taylor Swift, X heat vs Spotify momentum this week',
  },
  {
    id: 'events-demand-layer',
    title: 'Events demand layer',
    stage: 'planned',
    access: 'core',
    area: 'Events',
    surface: 'Entertainment, culture, local',
    summary: 'Live event pulse that overlays trending X topics with concerts, tours, venues, ticket links, and date context.',
    next: 'Prototype official event validation using Ticketmaster or Bandsintown links on music and culture briefs.',
    seedVotes: 20,
    complianceNote: 'Link to official event discovery and commerce surfaces; do not imply resale or scrape ticket inventory.',
  },
  {
    id: 'entity-enrichment-layer',
    title: 'Entity enrichment layer',
    stage: 'building',
    access: 'core',
    area: 'Entities',
    surface: 'All pulse and search pages',
    summary: 'Knowledge Graph-backed disambiguation, canonical descriptions, images, facts, and topic clustering.',
    next: 'Use entity resolution to make every person, brand, artist, company, and event card more trustworthy.',
    seedVotes: 26,
    complianceNote: 'Cache and attribute entity metadata according to provider rules.',
  },
  {
    id: 'video-evidence-layer',
    title: 'Video evidence layer',
    stage: 'planned',
    access: 'core',
    area: 'Video',
    surface: 'Briefs, topics, creator pages',
    summary: 'YouTube thumbnails, channel metadata, official videos, creator responses, and evidence links inside pulse briefs.',
    next: 'Start with link-and-thumbnail context for trailers, interviews, live streams, and creator announcements.',
    seedVotes: 19,
    complianceNote: 'Embed/link metadata and summaries; do not host or redistribute video content.',
  },
  {
    id: 'unified-entity-pages',
    title: 'Unified entity pages',
    stage: 'planned',
    access: 'core',
    area: 'Entities',
    surface: '/entity',
    summary: 'One public page for any artist, creator, event, brand, or company with X Pulse plus enriched multi-source context.',
    next: 'Define a common entity schema across X, Spotify, events, YouTube, Knowledge Graph, and web/news.',
    seedVotes: 30,
    complianceNote: 'Make the page an attribution-rich synthesis layer rather than an API data mirror.',
  },
  {
    id: 'signal-fusion-briefs',
    title: 'Signal Fusion Briefs',
    stage: 'planned',
    access: 'core',
    area: 'Briefs',
    surface: 'Reader, share pages',
    summary: 'Narrative cards that explain why a signal matters across X, Spotify, events, YouTube, Knowledge Graph, and web.',
    next: 'Build a reusable brief module: cause, X heat, outside signal, source links, and confidence.',
    seedVotes: 28,
    complianceNote: 'Show derived signals and links, not raw API dumps.',
  },
  {
    id: 'pro-music-creator-intel',
    title: 'Pro music and creator intelligence',
    stage: 'exploring',
    access: 'premium',
    area: 'Creator Economy',
    surface: 'Pro dashboards',
    summary: 'Artist trajectory reports, creator growth dashboards, release timing analysis, playlist context, and alerting.',
    next: 'Package music and creator economy dashboards as a vertical tier once core entity pages prove useful.',
    seedVotes: 23,
    complianceNote: 'Charge for synthesis, trend analysis, and monitoring, not provider metadata resale.',
  },
  {
    id: 'enterprise-event-intelligence',
    title: 'Enterprise event intelligence',
    stage: 'exploring',
    access: 'premium',
    area: 'Events',
    surface: 'Enterprise dashboards',
    summary: 'Ticket demand pulse, tour planning, city sentiment, venue context, and affiliate-safe ticket links.',
    next: 'Validate promoter and brand workflows with X buzz, official event data, and city-level sentiment.',
    seedVotes: 18,
    complianceNote: 'Use official discovery links and approved partner paths for commerce or demand signals.',
  },
  {
    id: 'cross-api-intelligence-os',
    title: 'Cross-API Intelligence OS',
    stage: 'exploring',
    access: 'premium',
    area: 'Platform',
    surface: 'SeekBox Pro',
    summary: 'A paid multi-source monitoring layer with custom monitors, exportable reports, and Slack or Discord alerts.',
    next: 'Turn the best vertical workflows into $19-49/mo Pro packaging before heavier enterprise API deals.',
    seedVotes: 32,
    complianceNote: 'Paid value is orchestration, synthesis, and workflow automation across sources.',
  },
  {
    id: 'agency-synth-feed-api',
    title: 'Agency synthesized feeds',
    stage: 'exploring',
    access: 'premium',
    area: 'API',
    surface: 'api.seekbox.ai',
    summary: 'Aggregated, synthesized feeds for agencies and media teams that need briefs, scores, source IDs, and links.',
    next: 'Define a strict output contract that blocks raw provider payload passthrough by default.',
    seedVotes: 17,
    complianceNote: 'API access should return aggregated insight, not raw third-party API dumps.',
  },
]

export const ROADMAP_ACCESS_LANES: {
  id: RoadmapAccess
  label: string
  headline: string
  summary: string
}[] = [
  {
    id: 'core',
    label: 'Core free',
    headline: 'Trust, SEO, sharing, and public habit.',
    summary:
      'Free surfaces should emphasize cache-first summaries, public attribution, drilldowns, and lightweight search limits.',
  },
  {
    id: 'premium',
    label: 'Premium',
    headline: 'Charge for synthesis, tools, limits, and workflow.',
    summary:
      'Paid value should come from multi-AI synthesis, alerts, reports, team dashboards, APIs, and power-user controls.',
  },
]

export const ROADMAP_COMPLIANCE_GUARDRAILS = [
  'Do not sell or export raw X posts at scale.',
  'Use official/approved X access for read-heavy paid workflows.',
  'Prefer summaries, scores, citations, post IDs, and links over copied full text.',
  'Keep attribution visible and make deletion-aware cache behavior part of the data model.',
  'Bill for SeekBox synthesis, UX, alerts, reports, and workflow automation rather than raw X data.',
]

export const ROADMAP_BIG_OPPORTUNITY = {
  headline: 'Bloomberg Terminal for X narratives',
  sub:
    'Free public pulses create habit and reach; premium synthesis, alerts, reports, and enterprise workflows turn the live narrative layer into a business.',
}

export const ROADMAP_INTEGRATION_PLATFORMS: RoadmapIntegrationPlatform[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    signal: 'Artists, albums, tracks, popularity, playlists',
    bestFor: 'Entertainment, music industry, creator economy',
    complianceNote:
      'Best used as metadata and synthesis context. Avoid streaming, redistribution, or raw catalog resale.',
    coreIdeas: [
      'Artist Pulse Cards: X heat vs Spotify momentum.',
      'New Release Radar: albums dropping this week plus X reactions.',
      'Entity enrichment for ambiguous artist and track names.',
    ],
    premiumIdeas: [
      'Artist trajectory reports with sentiment and popularity trends.',
      'Creator or label alerts for buzz plus streaming velocity.',
      'Playlist context in music industry pulse briefs.',
    ],
  },
  {
    id: 'events',
    name: 'Bandsintown + Ticketmaster',
    signal: 'Events, venues, lineups, tickets, demand context',
    bestFor: 'Music, sports, comedy, culture, local discovery',
    complianceNote:
      'Use official event discovery, attribution, and allowed commerce paths. Do not imply unauthorized resale.',
    coreIdeas: [
      'Live Events Pulse: X topics overlaid with concerts, tours, dates, venues, and ticket links.',
      'Tour Signal Heatmap: artists touring near you correlated with X conversation volume.',
      'Event validation against official event records.',
    ],
    premiumIdeas: [
      'Ticket Demand Pulse for promoters and brands.',
      'Tour planning tool with city sentiment and venue data.',
      'Affiliate-safe ticket links in premium briefs where allowed.',
    ],
  },
  {
    id: 'knowledge-graph',
    name: 'Google Knowledge Graph',
    signal: 'Entity resolution, descriptions, images, notable facts',
    bestFor: 'Every vertical where names, companies, events, or brands collide',
    complianceNote:
      'Good fit for attribution-rich caching and disambiguation; keep source attribution visible.',
    coreIdeas: [
      'Smart disambiguation for people, companies, artists, brands, and events.',
      'Rich Pulse Cards with entity images, bios, and short context.',
      'Topic clustering through canonical entity links.',
    ],
    premiumIdeas: [
      'Deep entity reports with X history and cross-signal trend lines.',
      'Research timelines and relationship maps for pro users.',
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    signal: 'Videos, channels, stats, announcements, thumbnails',
    bestFor: 'Creators, entertainment, news, launches, visual evidence',
    complianceNote:
      'Use video metadata, links, thumbnails, and summaries. Do not host or redistribute video content.',
    coreIdeas: [
      'Video evidence layer for trailers, interviews, live streams, and creator responses.',
      'Creator Pulse: YouTube channel context alongside X activity.',
      'Visual context in briefs through thumbnails and official video links.',
    ],
    premiumIdeas: [
      'Multi-platform creator dashboard with X plus YouTube metrics.',
      'Best Clips summaries with timestamps and links only.',
      'Trend forecasting from early X buzz and YouTube performance.',
    ],
  },
  {
    id: 'cross-api',
    name: 'Cross-API fusion',
    signal: 'X Pulse plus music, events, entities, video, web, and news',
    bestFor: 'Signal fusion briefs, entity pages, vertical products, agency APIs',
    complianceNote:
      'The product should synthesize and cite. Avoid becoming a bulk mirror of any source API.',
    coreIdeas: [
      'Unified entity pages for artists, creators, events, brands, and companies.',
      "What's Happening Tonight: location-aware events plus X chatter when allowed.",
      'Signal Fusion Briefs that explain cause, evidence, momentum, and confidence.',
    ],
    premiumIdeas: [
      'SeekBox Pro Intelligence OS with custom monitors and alerts.',
      'Vertical tiers for music, creator economy, events, and live culture.',
      'Synthesized API feeds for agencies and media teams.',
    ],
  },
]

export const LIVE_X_ROADMAP_NOTE = {
  headline: 'Why Live X stays on the roadmap',
  sub:
    'Live X pulls fresh posts, trends, sentiment, and context minutes after they surface. The roadmap turns that into repeatable product modes instead of a loose demo drawer.',
  bullets: [
    'Reader pages should show cached signal before a user searches.',
    'Search pages should explain which models and search sources did what.',
    'Intel workbenches should start with curated examples and current cache-derived suggestions.',
  ],
}

export const ROADMAP_SEARCH_MODES: { id: string; label: string; prompt: string; stage: RoadmapStage }[] = [
  {
    id: 'earnings-reaction',
    label: 'Earnings reaction',
    prompt: 'Real-time market and X sentiment on Nvidia earnings right now',
    stage: 'live',
  },
  {
    id: 'stock-deep-dive',
    label: 'Stock deep dive',
    prompt: 'Current trader sentiment on TSLA stock plus key narratives on X',
    stage: 'building',
  },
  {
    id: 'breaking-news',
    label: 'Breaking news',
    prompt: 'How is the market reacting to the latest Fed decision live on X?',
    stage: 'planned',
  },
  {
    id: 'sector-trend',
    label: 'Sector trend',
    prompt: 'Emerging narratives around solid-state batteries and EV stocks this week',
    stage: 'planned',
  },
  {
    id: 'post-trade-validation',
    label: 'Post-trade validation',
    prompt: 'Current X sentiment and counter-narratives on my recent AMD position',
    stage: 'exploring',
  },
]

export const ROADMAP_USE_CASE_PLAYS: { title: string; audience: string; prompts: string[] }[] = [
  {
    title: 'Live market and sentiment',
    audience: 'Day traders, crypto, analyst workflows',
    prompts: [
      "What's the actual trader sentiment on Nvidia earnings right now?",
      'How is Bitcoin reacting on X in the last few hours, bullish or exhausted?',
    ],
  },
  {
    title: 'Breaking news and verification',
    audience: 'Journalists, crisis comms, political analysts',
    prompts: [
      "What's really happening with today's biggest headline, confirm vs rumor mill on X",
      'Debunk or contextualize this viral claim with opposing narratives seen on X',
    ],
  },
  {
    title: 'Product and brand pulse',
    audience: 'Founders, PMs, marketing teams',
    prompts: [
      'What are developers saying about the latest Expo Router release on X?',
      'Public reaction to the most talked-about AI announcement today, sentiment snapshot',
    ],
  },
  {
    title: 'Emerging narratives',
    audience: 'VC, newsletters, futurists',
    prompts: [
      'What conversations around AI agents are bubbling on X this week beyond mainstream headlines?',
      'Early signals on a niche tech wave before it hits mainstream tech press',
    ],
  },
]

export const ROADMAP_PROMPT_SECTIONS: { category: string; prompts: ShowcasePrompt[] }[] = [
  {
    category: 'Market and investing',
    prompts: [
      {
        text: "What is the real market reaction to Nvidia's latest earnings?",
        featured: true,
        hint: 'Fresh sentiment',
      },
      {
        text: 'Compare Tesla FSD v13 vs Waymo current performance and public sentiment',
        featured: true,
      },
      {
        text: 'Impact of solid-state batteries on EV stocks and market sentiment today',
        featured: true,
      },
      {
        text: 'Is Bitcoin overvalued right now? Show latest analyst and X opinions',
      },
    ],
  },
  {
    category: 'Tech and product launches',
    prompts: [
      {
        text: 'Compare xAI reasoning vs Claude Sonnet 4 vs GPT-5.2, which is best for coding?',
        featured: true,
      },
      {
        text: 'What are developers actually saying about the new iOS features on X?',
      },
      {
        text: 'Expo Router 5 vs Next.js App Router, pros, cons, and real user feedback',
      },
    ],
  },
  {
    category: 'News and current events',
    prompts: [
      {
        text: "What's the latest on today's biggest headline, compare model perspectives plus live X reaction",
      },
      {
        text: 'Public sentiment on the latest policy announcement',
      },
      {
        text: 'Did OpenAI just announce something big? Show real reactions',
      },
    ],
  },
  {
    category: 'Deep analysis',
    prompts: [
      {
        text: 'CRAAP test the latest claims about AI replacing programmers',
      },
      {
        text: 'Triangulate what multiple sources say about climate change acceleration',
      },
      {
        text: 'Debate whether remote work is declining in 2026',
      },
      {
        text: 'What are the biggest risks and opportunities in AI investing right now?',
      },
    ],
  },
]

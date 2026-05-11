export type IndustryPageConfig = {
  slug: string
  label: string
  eyebrow: string
  description: string
  customer: string
  whyGrok: string
  handles: string[]
  tags: string[]
  questions: string[]
  operatorView: string[]
}

const INDUSTRY_SLUG_ALIASES: Record<string, string> = {
  ai: 'tech-saas',
  artificialintelligence: 'tech-saas',
  artificial_intelligence: 'tech-saas',
  'artificial-intelligence': 'tech-saas',
  finance_markets: 'finance',
  'finance-markets': 'finance',
  financial: 'finance',
  financial_services: 'finance',
  'financial-services': 'finance',
  health: 'healthcare',
  market: 'finance',
  markets: 'finance',
  media: 'sports-entertainment',
  medical: 'healthcare',
  medicine: 'healthcare',
  real_estate: 'real-estate',
  realestate: 'real-estate',
  saas: 'tech-saas',
  software: 'tech-saas',
  sport: 'sports-entertainment',
  sports: 'sports-entertainment',
  tech: 'tech-saas',
  technology: 'tech-saas',
  tourism: 'travel-tourism',
  travel: 'travel-tourism',
  web3: 'crypto',
}

export function canonicalizeIndustrySlug(slug: string | undefined | null): string {
  const clean = (slug ?? '').toLowerCase().trim()
  return INDUSTRY_SLUG_ALIASES[clean] ?? clean
}

export function scopeValuesForIndustrySlug(slug: string | undefined | null): string[] {
  const canonical = canonicalizeIndustrySlug(slug)
  if (!canonical) return []
  const aliases = Object.entries(INDUSTRY_SLUG_ALIASES)
    .filter(([, value]) => value === canonical)
    .map(([alias]) => alias)
  return Array.from(new Set([canonical, ...aliases]))
}

export const INDUSTRY_PAGES: IndustryPageConfig[] = [
  {
    slug: 'healthcare',
    label: 'Healthcare',
    eyebrow: 'clinicians, researchers, and health-policy voices',
    description:
      'A cached X pulse for clinicians, researchers, public-health disputes, wellness narratives, and the health-policy voices shaping the feed.',
    customer: 'clinicians, health founders, advisors, analysts, and care operators who need the live narrative layer',
    whyGrok:
      'Healthcare buyers need a fast read without losing provenance. The page should surface clinical themes, public-health mood, dissent, and source trails before anyone pays for a deeper pull.',
    handles: ['PeterAttiaMD', 'hubermanlab', 'drericding', 'AaronSiriSG', 'EricTopol', 'RWMaloneMD', 'drmarkhyman'],
    tags: ['healthcare', 'medicine', 'policy', 'wellness'],
    questions: [
      'What healthcare narrative changed this week and who is driving it?',
      'Where are clinicians split from public-health institutions?',
      'Which posts are getting outsized attention or backlash?',
      'What topic deserves a deeper live Grok pull?',
    ],
    operatorView: [
      'This page is a read layer, not medical advice. Keep citations visible and opinion labels plain.',
      'The product value is knowing which health narratives are moving before conventional coverage packages them.',
      'Future structure should separate clinical, policy, wellness, and dissent signals.',
    ],
  },
  {
    slug: 'tech-saas',
    label: 'Tech & SaaS',
    eyebrow: 'builders, model labs, and software operators',
    description:
      'A cached X pulse for AI, SaaS, platform shifts, model launches, developer tools, and enterprise deployment narratives.',
    customer: 'founders, operators, analysts, and sales teams selling into AI/software accounts',
    whyGrok:
      'This customer wants the first version of the story: product launches, founder reactions, model-war sentiment, and the practical constraints people complain about before they become blog posts.',
    handles: ['sama', 'karpathy', 'ylecun', 'swyx', 'paulg', 'levie', 'dharmesh', 'geoffreyhinton', 'elonmusk'],
    tags: ['AI', 'SaaS', 'agents', 'developer tools'],
    questions: [
      'What changed in AI/SaaS this week and who is driving it?',
      'Which product or model launches are getting operator attention?',
      'Where are enterprise buyers excited versus blocked?',
      'Which dissenting voices are pushing back on the hype?',
    ],
    operatorView: [
      'Cached pulse is the default surface; deep live pulls should be for named accounts, competitor moments, and launch weeks.',
      'The sales angle is not generic AI news. It is "what are builders already reacting to on X?"',
      'Trend charts should graduate from heuristics to structured topic scores once the Worker writes them.',
    ],
  },
  {
    slug: 'finance',
    label: 'Finance & Markets',
    eyebrow: 'macro, equities, and capital flows',
    description:
      'A markets-focused X pulse for macro takes, equity narratives, risk-on/risk-off language, and the finance voices pushing a trade into the timeline.',
    customer: 'market watchers, advisors, creators, founders, and research teams that need the live narrative layer',
    whyGrok:
      'Finance customers pay for speed, but they also need provenance. Grok/X is useful when the question is "what are traders saying right now?" and not just "what did the close print?"',
    handles: ['RayDalio', 'michaelburry', 'CathieDWood', 'WallStreetMav', 'FinancialJuice', 'LizAnnSonders', 'zerohedge'],
    tags: ['macro', 'equities', 'rates', 'sentiment'],
    questions: [
      'What market narrative is getting louder today?',
      'Which tickers, sectors, or macro prints are showing up repeatedly?',
      'Where is consensus fragile or overconfident?',
      'What deserves a deeper ticker pulse?',
    ],
    operatorView: [
      'This page should avoid pretending to be a brokerage terminal. Its job is narrative discovery and source trails.',
      'The ticker page becomes the paid-work surface: pick a symbol, pull Grok/X, then compare against web and model reasoning.',
      'Charts should eventually separate topic frequency, sentiment, source influence, and ticker mentions.',
    ],
  },
  {
    slug: 'real-estate',
    label: 'Real Estate',
    eyebrow: 'housing, agents, rates, and property operators',
    description:
      'A cached X pulse for housing narratives, real-estate operators, rate sensitivity, listings, affordability, and the local-market stories starting to travel.',
    customer: 'agents, brokers, investors, lenders, operators, and local-market analysts',
    whyGrok:
      'Real estate is local and emotional. Grok/X is useful when rates, affordability, inventory, or neighborhood narratives start moving before the polished market note arrives.',
    handles: ['Redfin', 'Zillow', 'Realtor', 'WSJrealestate', 'CNBChousing'],
    tags: ['housing', 'rates', 'inventory', 'property'],
    questions: [
      'Which housing narrative is getting louder this week?',
      'Where are agents, buyers, and market watchers disagreeing?',
      'Which rate, inventory, or affordability signal deserves follow-up?',
      'What local-market story is crossing into national attention?',
    ],
    operatorView: [
      'This should read like a housing desk: useful for spotting narratives, not pricing homes.',
      'Keep institutional and operator voices visible so users can tell source type at a glance.',
      'Future charts should separate affordability, inventory, rates, and regional heat.',
    ],
  },
  {
    slug: 'crypto',
    label: 'Crypto',
    eyebrow: 'protocols, exchanges, regulation, and web3 builders',
    description:
      'A cached X pulse for crypto market narratives, protocol debates, exchange chatter, policy shifts, and the builder/investor voices moving web3 attention.',
    customer: 'market watchers, builders, analysts, advisors, and creators tracking web3 narratives',
    whyGrok:
      'Crypto lives on X. The cheap layer should catch narrative velocity and dissent first, then send users to ticker or live search only when the source trail justifies it.',
    handles: ['VitalikButerin', 'cz_binance', 'aantonop', 'coinbase', 'CoinDesk'],
    tags: ['crypto', 'web3', 'regulation', 'markets'],
    questions: [
      'What crypto narrative is moving right now?',
      'Which protocol, exchange, or policy story is getting repeated?',
      'Where are builders and traders disagreeing?',
      'What deserves a ticker or token-level deeper pull?',
    ],
    operatorView: [
      'Keep this framed as narrative intelligence, not trading advice.',
      'The useful cut is source-backed momentum: what keeps appearing, who is amplifying, and what dissent exists.',
      'Future data should split token mentions, policy/regulatory chatter, protocol debates, and exchange risk.',
    ],
  },
  {
    slug: 'travel-tourism',
    label: 'Travel & Tourism',
    eyebrow: 'destinations, airlines, lodging, and travel operators',
    description:
      'A cached X pulse for travel demand, destination chatter, airline friction, hospitality narratives, and tourism stories worth reading before a live pull.',
    customer: 'travel operators, hospitality teams, local marketers, creators, and analysts',
    whyGrok:
      'Travel narratives can move from a complaint, storm, event, fare, or creator post into business impact quickly. This page should preserve the early signal and receipts.',
    handles: ['NomadicMatt', 'TravelLeisure', 'lonelyplanet', 'secretescapes'],
    tags: ['travel', 'tourism', 'hospitality', 'destinations'],
    questions: [
      'What travel or tourism story is getting attention this week?',
      'Where are travelers frustrated versus excited?',
      'Which destination, airline, or lodging narrative deserves follow-up?',
      'What local story is becoming a broader travel trend?',
    ],
    operatorView: [
      'This should read like a compact travel desk, not a booking site.',
      'The product value is catching emerging attention and complaint clusters with citations attached.',
      'Future structure should split destinations, lodging, airlines, events, and weather/disruption signals.',
    ],
  },
  {
    slug: 'sports-entertainment',
    label: 'Sports & Entertainment',
    eyebrow: 'leagues, athletes, creators, rights, and culture',
    description:
      'A pulse page for sports, entertainment, creator economics, media rights, fandom, athlete narratives, and culture moments crossing over into business.',
    customer: 'agencies, creators, analysts, sponsors, and teams watching what fans and insiders are amplifying',
    whyGrok:
      'The value is the crossover signal: when a player, league, artist, sponsor, or fandom story starts moving before conventional coverage packages it.',
    handles: ['StephenCurry30', 'espn', 'TheAthletic', 'ChampagnePapi'],
    tags: ['sports', 'media rights', 'creators', 'culture'],
    questions: [
      'Which sports or entertainment story is crossing into business impact?',
      'Who is amplifying the narrative: leagues, athletes, creators, or press?',
      'Where are fans split from official coverage?',
      'What sponsor, rights, or creator angle is emerging?',
    ],
    operatorView: [
      'This should read more like a highlights desk than an analyst memo.',
      'The product can win by catching the cultural turn early, then preserving citations for follow-up.',
      'Structured future data should track fandom velocity, sponsor mentions, rights chatter, and cross-handle engagement.',
    ],
  },
]

export function getIndustryPage(slug: string | undefined | null): IndustryPageConfig | null {
  const clean = canonicalizeIndustrySlug(slug)
  if (!clean) return null
  return INDUSTRY_PAGES.find((industry) => industry.slug === clean) ?? null
}

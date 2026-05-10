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

export const INDUSTRY_PAGES: IndustryPageConfig[] = [
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
  if (!slug) return null
  const clean = slug.toLowerCase().trim()
  return INDUSTRY_PAGES.find((industry) => industry.slug === clean) ?? null
}

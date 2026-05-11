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

type IndustrySeed = Pick<IndustryPageConfig, 'slug' | 'label' | 'description' | 'handles' | 'tags'>

const INDUSTRY_SLUG_ALIASES: Record<string, string> = {
  ag: 'agriculture',
  ai: 'tech-saas',
  advertising: 'marketing-advertising',
  artificialintelligence: 'tech-saas',
  artificial_intelligence: 'tech-saas',
  'artificial-intelligence': 'tech-saas',
  auto: 'automotive',
  beauty: 'beauty-cosmetics',
  beauty_and_cosmetics: 'beauty-cosmetics',
  'beauty-and-cosmetics': 'beauty-cosmetics',
  charity: 'nonprofit-charity',
  climate: 'energy-sustainability',
  construction: 'construction-trades',
  construction_and_trades: 'construction-trades',
  'construction-and-trades': 'construction-trades',
  cosmetics: 'beauty-cosmetics',
  dtc: 'ecommerce-retail',
  ecommerce: 'ecommerce-retail',
  ecommerce_and_retail: 'ecommerce-retail',
  'ecommerce-and-retail': 'ecommerce-retail',
  'e-commerce': 'ecommerce-retail',
  'e-commerce-and-retail': 'ecommerce-retail',
  edtech: 'education',
  education: 'education',
  energy: 'energy-sustainability',
  ev: 'automotive',
  farming: 'agriculture',
  finance_and_markets: 'finance',
  'finance-and-markets': 'finance',
  finance_markets: 'finance',
  'finance-markets': 'finance',
  financial: 'finance',
  financial_services: 'finance',
  'financial-services': 'finance',
  fitness: 'fitness-wellness',
  fitness_and_wellness: 'fitness-wellness',
  'fitness-and-wellness': 'fitness-wellness',
  food: 'food-beverage',
  food_and_beverage: 'food-beverage',
  'food-and-beverage': 'food-beverage',
  government: 'government-public',
  government_and_public_sector: 'government-public',
  'government-and-public-sector': 'government-public',
  growth: 'marketing-advertising',
  health: 'healthcare',
  hospitality: 'travel-tourism',
  law: 'legal-services',
  legal: 'legal-services',
  learning: 'education',
  longevity: 'fitness-wellness',
  manufacturing: 'manufacturing',
  market: 'finance',
  markets: 'finance',
  marketing: 'marketing-advertising',
  marketing_and_advertising: 'marketing-advertising',
  'marketing-and-advertising': 'marketing-advertising',
  media: 'sports-entertainment',
  medical: 'healthcare',
  medicine: 'healthcare',
  nonprofit: 'nonprofit-charity',
  nonprofit_and_charity: 'nonprofit-charity',
  'nonprofit-and-charity': 'nonprofit-charity',
  philanthropy: 'nonprofit-charity',
  policy: 'government-public',
  public: 'government-public',
  public_sector: 'government-public',
  'public-sector': 'government-public',
  real_estate: 'real-estate',
  realestate: 'real-estate',
  restaurant: 'food-beverage',
  restaurants: 'food-beverage',
  retail: 'ecommerce-retail',
  saas: 'tech-saas',
  software: 'tech-saas',
  sport: 'sports-entertainment',
  sports: 'sports-entertainment',
  sports_and_entertainment: 'sports-entertainment',
  'sports-and-entertainment': 'sports-entertainment',
  sustainability: 'energy-sustainability',
  energy_and_sustainability: 'energy-sustainability',
  'energy-and-sustainability': 'energy-sustainability',
  tech: 'tech-saas',
  technology: 'tech-saas',
  tourism: 'travel-tourism',
  trades: 'construction-trades',
  travel: 'travel-tourism',
  wellness: 'fitness-wellness',
}

const INDUSTRY_SEEDS: IndustrySeed[] = [
  {
    slug: 'healthcare',
    label: 'Healthcare',
    description: 'What clinicians, researchers, and health-policy voices are saying right now.',
    handles: ['PeterAttiaMD', 'hubermanlab', 'drericding', 'AaronSiriSG', 'EricTopol', 'RWMaloneMD', 'drmarkhyman'],
    tags: ['health', 'medicine', 'wellness'],
  },
  {
    slug: 'tech-saas',
    label: 'Tech & SaaS',
    description: 'Founders, researchers, and operators building AI and software.',
    handles: ['sama', 'karpathy', 'ylecun', 'swyx', 'paulg', 'levie', 'dharmesh', 'geoffreyhinton', 'elonmusk'],
    tags: ['ai', 'startups', 'software'],
  },
  {
    slug: 'finance',
    label: 'Finance & Markets',
    description: 'Macro, equities, and the people moving capital - without the noise.',
    handles: ['RayDalio', 'michaelburry', 'CathieDWood', 'WallStreetMav', 'FinancialJuice', 'LizAnnSonders', 'zerohedge'],
    tags: ['markets', 'macro', 'investing'],
  },
  {
    slug: 'real-estate',
    label: 'Real Estate',
    description: 'Operators, agents, and investors on the residential and commercial markets.',
    handles: ['sweatystartup', 'grantcardone', 'MikeFhomes', 'JoshAltman', 'tomferry', 'redfinrachel'],
    tags: ['real-estate', 'investing'],
  },
  {
    slug: 'food-beverage',
    label: 'Food & Beverage',
    description: 'Chefs, food writers, and restaurant operators on what is actually happening.',
    handles: ['DavidChang', 'AlisonRoman', 'claire_saffitz'],
    tags: ['food', 'restaurants'],
  },
  {
    slug: 'travel-tourism',
    label: 'Travel & Tourism',
    description: 'Where people are going, what is broken, and what is finally back.',
    handles: ['NomadicMatt', 'TravelLeisure', 'lonelyplanet', 'secretescapes'],
    tags: ['travel', 'hospitality'],
  },
  {
    slug: 'education',
    label: 'Education',
    description: 'Educators, ed-tech founders, and learning-science researchers.',
    handles: ['khanacademy', 'SalmanKhan', 'RobertCialdini', 'AngelaDuckw', 'RickHess99'],
    tags: ['edtech', 'learning'],
  },
  {
    slug: 'ecommerce-retail',
    label: 'E-commerce & Retail',
    description: 'DTC operators, platform leaders, and the retail experts moving SKUs.',
    handles: ['harleyf', 'shopify', 'tobi', 'scottbelsky'],
    tags: ['ecommerce', 'dtc'],
  },
  {
    slug: 'fitness-wellness',
    label: 'Fitness & Wellness',
    description: 'Performance science, longevity, and what actually works in the gym.',
    handles: ['hubermanlab', 'PeterAttiaMD', 'RhondaPatrick', 'drmarkhyman', 'garyvee'],
    tags: ['fitness', 'longevity'],
  },
  {
    slug: 'marketing-advertising',
    label: 'Marketing & Advertising',
    description: 'Positioning, growth, and the operators shipping campaigns this week.',
    handles: ['neilpatel', 'AprilDunford', 'growthtwt', 'amandanat', 'RandFish'],
    tags: ['marketing', 'growth'],
  },
  {
    slug: 'construction-trades',
    label: 'Construction & Trades',
    description: 'Builders, contractors, and small-business operators in the field.',
    handles: ['sweatystartup', 'codie_sanchez', 'buildwitt'],
    tags: ['trades', 'construction'],
  },
  {
    slug: 'legal-services',
    label: 'Legal Services',
    description: 'Practicing attorneys, legal scholars, and litigation watchers.',
    handles: ['kovarsky', 'joshblackman', 'elliotdorfman'],
    tags: ['law', 'legal'],
  },
  {
    slug: 'manufacturing',
    label: 'Manufacturing',
    description: 'Industry leaders on supply chain, automation, and the factory floor.',
    handles: ['JimCramer'],
    tags: ['manufacturing', 'supply-chain'],
  },
  {
    slug: 'nonprofit-charity',
    label: 'Nonprofit & Charity',
    description: 'Foundations, advocates, and the orgs deploying capital into good.',
    handles: ['BillGates', 'gatesfoundation', 'MalalaFund', 'propublica'],
    tags: ['nonprofit', 'philanthropy'],
  },
  {
    slug: 'energy-sustainability',
    label: 'Energy & Sustainability',
    description: 'Climate, clean-tech, and grid economics from people building it.',
    handles: ['cleantechnica', 'BloombergNEF', 'MichaelEMann'],
    tags: ['climate', 'energy'],
  },
  {
    slug: 'beauty-cosmetics',
    label: 'Beauty & Cosmetics',
    description: 'Founders, formulators, and culture watchers in beauty.',
    handles: ['beautypie', 'estee_laundry'],
    tags: ['beauty', 'dtc'],
  },
  {
    slug: 'automotive',
    label: 'Automotive',
    description: 'OEMs, EVs, and the auto press tracking the transition.',
    handles: ['SawyerMerritt', 'teslarati', 'MotorTrend', 'Jalopnik'],
    tags: ['automotive', 'ev'],
  },
  {
    slug: 'agriculture',
    label: 'Agriculture',
    description: 'Producers, ag-tech operators, and the policy that shapes the farm.',
    handles: ['AgWeb', 'ModernFarmer', 'USDA', 'FarmBureau'],
    tags: ['agriculture', 'farming'],
  },
  {
    slug: 'sports-entertainment',
    label: 'Sports & Entertainment',
    description: 'The leagues, the athletes, and the deals reshaping the business.',
    handles: ['StephenCurry30', 'espn', 'TheAthletic', 'ChampagnePapi'],
    tags: ['sports', 'entertainment'],
  },
  {
    slug: 'government-public',
    label: 'Government & Public Sector',
    description: 'Federal-policy and civic-tech voices - institutional handles only.',
    handles: ['GovTrack', 'StateDept', 'SecBlinken'],
    tags: ['government', 'policy'],
  },
]

export function canonicalizeIndustrySlug(slug: string | undefined | null): string {
  const clean = cleanIndustrySlug(slug)
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

export const INDUSTRY_PAGES: IndustryPageConfig[] = INDUSTRY_SEEDS.map(toIndustryPage)

export function getIndustryPage(slug: string | undefined | null): IndustryPageConfig | null {
  const clean = canonicalizeIndustrySlug(slug)
  if (!clean) return null
  return INDUSTRY_PAGES.find((industry) => industry.slug === clean) ?? null
}

function toIndustryPage(seed: IndustrySeed): IndustryPageConfig {
  return {
    ...seed,
    eyebrow: `${seed.tags.slice(0, 3).join(', ')} voices`,
    customer: `${seed.label.toLowerCase()} operators, analysts, founders, and advisors tracking the live X narrative`,
    whyGrok: `${seed.label} buyers need the fast version of the story before it becomes a polished recap. This page keeps the cached X pulse, source trails, dissent, and repeated themes close together so a deeper pull starts from context.`,
    questions: [
      `What changed in ${seed.label} this week and who is driving it?`,
      `Which ${seed.label.toLowerCase()} narratives are getting repeated across credible voices?`,
      'Where are operators, customers, or institutions disagreeing?',
      'What deserves a deeper live Grok pull next?',
    ],
    operatorView: [
      `This page should read like a compact ${seed.label.toLowerCase()} desk: useful for spotting narratives, not pretending to be a final report.`,
      'Keep institutional, operator, and creator voices visible so source type is obvious.',
      'Future structured data should split topic frequency, sentiment, source influence, and dissent.',
    ],
  }
}

function cleanIndustrySlug(slug: string | undefined | null): string {
  return (slug ?? '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, '-')
}

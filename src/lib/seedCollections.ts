export type SeedCollectionKind = 'local_scene' | 'brand' | 'city' | 'culture' | 'music'
export type SeedOutputView = 'pulse' | 'leaderboard' | 'calendar' | 'brief' | 'raw_debug'
export type SeedVisibility = 'public' | 'internal'

export type SeedLocation = {
  label: string
  latitude: number
  longitude: number
  radius: string
}

export type SeedCollection = {
  id: string
  label: string
  summary: string
  kind: SeedCollectionKind
  visibility: SeedVisibility
  queries: string[]
  handles: string[]
  locations: SeedLocation[]
  tags: string[]
  outputDefaults: {
    view: SeedOutputView
    tone: string
    depth: 'quick' | 'balanced' | 'deep'
  }
}

export const SEED_COLLECTIONS: SeedCollection[] = [
  {
    id: 'tulsa-live-music',
    label: 'Tulsa Live Music',
    summary: 'Local venues, artists, concerts, music writers, and weekend show chatter around Tulsa.',
    kind: 'local_scene',
    visibility: 'public',
    queries: [
      'Tulsa live music this week',
      "Tulsa concerts Cain's Ballroom The Vanguard Mercury Lounge",
      'Tulsa music scene local artists venues',
    ],
    handles: ['cainsballroom', 'thevanguardtul', 'MercuryLoungeOK', 'tulsaworld'],
    locations: [{ label: 'Tulsa, OK', latitude: 36.154, longitude: -95.9928, radius: '25mi' }],
    tags: ['tulsa', 'live-music', 'events', 'venues'],
    outputDefaults: { view: 'pulse', tone: 'local', depth: 'balanced' },
  },
  {
    id: 'charleston-live-music',
    label: 'Charleston Live Music',
    summary: 'Venue calendars, local performers, festival chatter, and nightlife signals around Charleston.',
    kind: 'local_scene',
    visibility: 'public',
    queries: [
      'Charleston SC live music this week',
      'Charleston concerts Music Farm Pour House local bands',
      'Charleston music scene events venues',
    ],
    handles: ['chsmusicfarm', 'chspourhouse', 'ExploreCHS'],
    locations: [{ label: 'Charleston, SC', latitude: 32.7765, longitude: -79.9311, radius: '20mi' }],
    tags: ['charleston', 'live-music', 'events', 'venues'],
    outputDefaults: { view: 'pulse', tone: 'local', depth: 'balanced' },
  },
  {
    id: 'porsche-market',
    label: 'Porsche Market',
    summary: 'Collector sentiment, allocations, EV strategy, GT cars, dealership chatter, and enthusiast debates.',
    kind: 'brand',
    visibility: 'public',
    queries: [
      'Porsche 911 GT3 allocation market sentiment',
      'Porsche EV strategy Macan Taycan enthusiast reaction',
      'Porsche collector market prices auctions',
    ],
    handles: ['Porsche', 'PorscheRaces', 'bringatrailer', 'CarsAndBids'],
    locations: [],
    tags: ['porsche', 'cars', 'luxury', 'collectors'],
    outputDefaults: { view: 'brief', tone: 'buyer', depth: 'balanced' },
  },
  {
    id: 'composers-and-classical',
    label: 'Composers and Classical',
    summary: 'Composer discourse, performances, new recordings, programming trends, and musicology threads.',
    kind: 'music',
    visibility: 'public',
    queries: [
      'classical composers new recordings performance discussion',
      'contemporary classical composers premieres reviews',
      'orchestra programming composers debate',
    ],
    handles: ['nyphil', 'londonsymphony', 'NaxosRecords', 'deccaclassics'],
    locations: [],
    tags: ['composers', 'classical', 'music', 'culture'],
    outputDefaults: { view: 'brief', tone: 'critic', depth: 'deep' },
  },
  {
    id: 'live-music-discovery',
    label: 'Live Music Discovery',
    summary: 'Cross-city signals for shows, venues, touring artists, promoters, and audience momentum.',
    kind: 'music',
    visibility: 'public',
    queries: [
      'live music discovery venues touring artists this week',
      'concert announcements local venues audience buzz',
      'music festivals venue calendars emerging artists',
    ],
    handles: ['Bandsintown', 'songkick', 'pollstar'],
    locations: [],
    tags: ['live-music', 'concerts', 'venues', 'artists'],
    outputDefaults: { view: 'leaderboard', tone: 'fan', depth: 'balanced' },
  },
  {
    id: 'local-culture-watch',
    label: 'Local Culture Watch',
    summary: 'A general seed for cities, restaurants, events, creators, civic chatter, and neighborhood discoveries.',
    kind: 'city',
    visibility: 'internal',
    queries: [
      'local culture events restaurants creators civic chatter',
      'what people are talking about locally this week',
      'local events food music neighborhoods social posts',
    ],
    handles: [],
    locations: [],
    tags: ['local', 'culture', 'events', 'cities'],
    outputDefaults: { view: 'pulse', tone: 'local', depth: 'quick' },
  },
]

export function publicSeedCollections(): SeedCollection[] {
  return SEED_COLLECTIONS.filter((seed) => seed.visibility === 'public')
}

export function seedPrimaryQuery(seed: SeedCollection): string {
  return seed.queries[0] ?? seed.label
}

export function seedUserSearchQuery(seed: SeedCollection): string {
  const location = seed.locations[0]?.label
  return [
    `${seed.label}: ${seedPrimaryQuery(seed)}`,
    location ? `Location focus: ${location}.` : '',
    'Return current pulse, key voices, source links, dissent, and what to watch next.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function seedDiscoveryQuery(seed: SeedCollection): string {
  const location = seed.locations[0]?.label
  if (location) return `top X posters in ${location} for ${seed.label}`
  return `${seed.label} top X voices and recent source posts`
}

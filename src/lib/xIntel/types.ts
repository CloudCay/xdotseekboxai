export type BattleWindow = '24h' | '7d' | '30d'

export type XIntelStatus = 'success' | 'error'

export type XIntelExcerpt = {
  text: string
  url?: string
}

export type XBattleInput = {
  handleA: string
  handleB: string
  window: BattleWindow
  clientId?: string
}

export type XBattleSide = {
  handle: string
  status: XIntelStatus
  postCount?: string
  sentiment?: string
  themes: string[]
  excerpts: XIntelExcerpt[]
  error?: string
}

export type XBattleResponse = {
  ok: boolean
  handleA: string
  handleB: string
  window: BattleWindow
  sides: {
    a: XBattleSide
    b: XBattleSide
  }
  generatedAt: string
  error?: string
}

export type AntiEchoInput = {
  claim: string
  clientId?: string
}

export type AntiEchoPost = {
  text: string
  url?: string
  handle?: string
}

export type AntiEchoResult = {
  ok: boolean
  claim: string
  status: XIntelStatus
  summary?: string
  strongestCounters: string[]
  posts: AntiEchoPost[]
  generatedAt: string
  error?: string
}

export type PostRoomInput = {
  input: string
  clientId?: string
}

export type PostRoomResult = {
  ok: boolean
  input: string
  status: XIntelStatus
  roomSummary?: string
  whyItMatters?: string
  positions: string[]
  relatedPosts: AntiEchoPost[]
  dissent?: string
  generatedAt: string
  error?: string
}

export type GatewayChatResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export const X_BATTLE_WINDOW_LABEL: Record<BattleWindow, string> = {
  '24h': 'Last 24h',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

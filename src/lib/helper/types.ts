export type HelperRole = 'user' | 'assistant'

export type HelperIntent =
  | 'help'
  | 'feedback'
  | 'feature'
  | 'bug'
  | 'support'
  | 'general'
  | 'idea'
  | 'must_have'
  | 'roadmap'

export interface HelperMessage {
  role: HelperRole
  content: string
}

export interface HelperChatRequest {
  history: HelperMessage[]
  message: string
  intent?: HelperIntent
  conversationId?: string
  clientId?: string
  userId?: string
  origin?: 'seekbox-web' | 'seekbox-native'
  pageContext?: string
}

export interface HelperUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

export interface HelperChatResponse {
  ok: boolean
  reply: string
  durationMs: number
  costUsd: number
  generatedAt: string
  knowledgeFiles: string[]
  intent: HelperIntent
  conversationId?: string
  usage?: HelperUsage
  cacheHitRatio?: number
  cached?: boolean
  persisted?: boolean
  error?: string
}

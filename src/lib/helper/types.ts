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

export interface HelperChatResponse {
  ok: boolean
  reply: string
  intent: HelperIntent
  conversationId?: string
  error?: string
}

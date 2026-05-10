import { useSyncExternalStore } from 'react'
import type { HelperIntent, HelperMessage } from './types'

const CLIENT_ID_KEY = 'seekbox-helper-client-id'
const AUTO_READ_KEY = 'seekly-auto-read-v1'

interface HelperState {
  isOpen: boolean
  intent: HelperIntent
  history: HelperMessage[]
  conversationId: string | undefined
  clientId: string
  pageContext: string | undefined
  autoRead: boolean
}

type HelperStore = HelperState & {
  setOpen: (open: boolean) => void
  toggle: () => void
  setIntent: (intent: HelperIntent) => void
  appendUser: (content: string) => void
  appendAssistant: (content: string) => void
  reset: () => void
  setConversationId: (id: string | undefined) => void
  setPageContext: (ctx: string | undefined) => void
  setAutoRead: (value: boolean) => void
  hydrateClientId: () => void
  hydrateAutoRead: () => void
}

let state: HelperState = {
  isOpen: false,
  intent: 'help',
  history: [],
  conversationId: undefined,
  clientId: '',
  pageContext: undefined,
  autoRead: false,
}

const listeners = new Set<() => void>()

function freshClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${crypto.randomUUID()}-${Date.now()}`
    }
  } catch {
    // Fall through to an ephemeral id.
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function setState(patch: Partial<HelperState> | ((current: HelperState) => HelperState)) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function hydrateClientId() {
  if (state.clientId || typeof window === 'undefined') return
  try {
    const stored = window.localStorage.getItem(CLIENT_ID_KEY)
    if (stored) {
      setState({ clientId: stored })
      return
    }
    const fresh = freshClientId()
    window.localStorage.setItem(CLIENT_ID_KEY, fresh)
    setState({ clientId: fresh })
  } catch {
    setState({ clientId: freshClientId() })
  }
}

function hydrateAutoRead() {
  if (typeof window === 'undefined') return
  try {
    setState({ autoRead: window.localStorage.getItem(AUTO_READ_KEY) === '1' })
  } catch {
    // Keep default false.
  }
}

export const helperStore: HelperStore = {
  get isOpen() {
    return state.isOpen
  },
  get intent() {
    return state.intent
  },
  get history() {
    return state.history
  },
  get conversationId() {
    return state.conversationId
  },
  get clientId() {
    return state.clientId
  },
  get pageContext() {
    return state.pageContext
  },
  get autoRead() {
    return state.autoRead
  },
  setOpen(open) {
    setState({ isOpen: open })
  },
  toggle() {
    setState({ isOpen: !state.isOpen })
  },
  setIntent(intent) {
    setState({ intent, conversationId: undefined })
  },
  appendUser(content) {
    setState((current) => ({
      ...current,
      history: [...current.history, { role: 'user', content }],
    }))
  },
  appendAssistant(content) {
    setState((current) => ({
      ...current,
      history: [...current.history, { role: 'assistant', content }],
    }))
  },
  reset() {
    setState({ history: [], conversationId: undefined })
  },
  setConversationId(id) {
    setState({ conversationId: id })
  },
  setPageContext(ctx) {
    setState({ pageContext: ctx })
  },
  setAutoRead(value) {
    setState({ autoRead: value })
    try {
      window.localStorage.setItem(AUTO_READ_KEY, value ? '1' : '0')
    } catch {
      // Storage can be unavailable in private windows.
    }
  },
  hydrateClientId,
  hydrateAutoRead,
}

export function useHelperStore<T>(selector: (current: HelperStore) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(helperStore),
    () => selector(helperStore),
  )
}

if (typeof window !== 'undefined') {
  hydrateAutoRead()
  hydrateClientId()
}

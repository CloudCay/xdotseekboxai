const KEY = 'xdot-client-id-v1'

function randomId(): string {
  try {
    // @ts-expect-error crypto may not exist in all runtimes
    return globalThis.crypto?.randomUUID?.() ?? `cid_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
  } catch {
    return `cid_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
  }
}

export function getClientId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    const existing = window.localStorage.getItem(KEY)
    if (existing) return existing
    const next = randomId()
    window.localStorage.setItem(KEY, next)
    return next
  } catch {
    return randomId()
  }
}


import type { AntiEchoInput, AntiEchoResult, PostRoomInput, PostRoomResult, XBattleInput, XBattleResponse } from './types'

async function postJson<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await response.json().catch(() => null)) as TResponse | { error?: string } | null
  if (!response.ok) {
    const message = json && typeof json === 'object' && 'error' in json && json.error ? json.error : `Request failed with HTTP ${response.status}`
    throw new Error(message)
  }
  if (!json) throw new Error('Empty response from X Intel API.')
  return json as TResponse
}

export function xBattle(input: XBattleInput): Promise<XBattleResponse> {
  return postJson<XBattleResponse>('/api/x-intel/x-battle', input)
}

export function antiEcho(input: AntiEchoInput): Promise<AntiEchoResult> {
  return postJson<AntiEchoResult>('/api/x-intel/anti-echo', input)
}

export function postRoom(input: PostRoomInput): Promise<PostRoomResult> {
  return postJson<PostRoomResult>('/api/x-intel/post-room', input)
}

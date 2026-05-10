import {
  Bot,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  Send,
  Square,
  User,
  Volume2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { helperChat } from '@/lib/helper/client'
import {
  INTENT_PILLS,
  STARTERS_BY_PILL,
  placeholderForPill,
} from '@/lib/helper/intents'
import { helperStore, useHelperStore } from '@/lib/helper/store'
import type { HelperMessage } from '@/lib/helper/types'
import { sanitizeTryTopic, stripDangerousControls } from '@/lib/helper/sanitize'
import { themeForSeekly, type SeeklyThemeName } from './seeklyTheme'

const SEEKLY_FONT = '"Trebuchet MS", "Lucida Sans Unicode", "Lucida Grande", sans-serif'
const TRY_RE = /\[TRY:\s*(.+?)\]\s*$/m

type SeeklyChatProps = {
  themeName: SeeklyThemeName
  onClose?: () => void
  pageContext?: string
  surfaceLabel?: string
  surfaceDescription?: string
  surfaceStarters?: string[]
}

export function SeeklyChat({
  themeName,
  onClose,
  pageContext,
  surfaceLabel,
  surfaceDescription,
  surfaceStarters = [],
}: SeeklyChatProps) {
  const theme = useMemo(() => themeForSeekly(themeName), [themeName])
  const intent = useHelperStore((state) => state.intent)
  const history = useHelperStore((state) => state.history)
  const conversationId = useHelperStore((state) => state.conversationId)
  const clientId = useHelperStore((state) => state.clientId)
  const storedPageContext = useHelperStore((state) => state.pageContext)
  const autoRead = useHelperStore((state) => state.autoRead)
  const [activePillId, setActivePillId] = useState(() => INTENT_PILLS[0]?.pillId ?? 'features')
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const lastAutoSpokenIdx = useRef(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [history.length, running])

  const stopSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Ignore browser speech failures.
    }
    utteranceRef.current = null
    setSpeakingId(null)
    setPaused(false)
  }, [])

  const speak = useCallback(
    (id: string, text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return
      stopSpeech()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.onend = () => {
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null
          setSpeakingId(null)
          setPaused(false)
        }
      }
      utterance.onerror = utterance.onend
      utteranceRef.current = utterance
      setSpeakingId(id)
      setPaused(false)
      window.speechSynthesis.speak(utterance)
    },
    [stopSpeech],
  )

  useEffect(() => stopSpeech, [stopSpeech])

  useEffect(() => {
    if (!autoRead || history.length === 0) return
    const lastIdx = history.length - 1
    const last = history[lastIdx]
    if (!last || last.role !== 'assistant' || lastAutoSpokenIdx.current >= lastIdx) return
    lastAutoSpokenIdx.current = lastIdx
    const spokenText = last.content.replace(TRY_RE, '').trim()
    if (spokenText) speak(`helper-${conversationId ?? 'pending'}-${lastIdx}`, spokenText)
  }, [autoRead, conversationId, history, speak])

  const send = useCallback(
    async (preset?: string) => {
      const message = (preset ?? input).trim()
      if (!message || running) return
      setError(null)
      setInput('')
      helperStore.appendUser(message)
      setRunning(true)
      try {
        const res = await helperChat({
          history,
          message,
          intent,
          conversationId,
          clientId,
          pageContext: pageContext ?? storedPageContext,
        })
        if (!res.ok) {
          setError(res.error || 'Helper failed')
        } else {
          helperStore.appendAssistant(stripDangerousControls(res.reply ?? '').trimEnd())
          if (res.conversationId) helperStore.setConversationId(res.conversationId)
        }
      } catch (sendError) {
        setError((sendError as Error)?.message || 'Network error')
      } finally {
        setRunning(false)
      }
    },
    [clientId, conversationId, history, input, intent, pageContext, running, storedPageContext],
  )

  const empty = history.length === 0 && !running

  return (
    <div className={`flex h-full min-h-0 flex-col ${theme.panel}`}>
      <div className={`flex flex-wrap items-center gap-1.5 border-b p-3 ${theme.border}`}>
        {INTENT_PILLS.map((pill) => {
          const active = pill.pillId === activePillId
          return (
            <button
              key={pill.pillId}
              type="button"
              disabled={running}
              onClick={() => {
                setActivePillId(pill.pillId)
                helperStore.setIntent(pill.intent)
              }}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                active ? 'border-blue-600 bg-blue-600 text-white' : `${theme.button}`
              }`}
              style={{ fontFamily: SEEKLY_FONT }}
            >
              {pill.label}
            </button>
          )
        })}
        <div className="flex-1" />
        {(history.length > 0 || conversationId) && (
          <button
            type="button"
            disabled={running}
            onClick={() => {
              helperStore.reset()
              setError(null)
              stopSpeech()
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${theme.button}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-3">
          {empty && (
            <Welcome
              activePillId={activePillId}
              onPick={send}
              themeName={themeName}
              surfaceLabel={surfaceLabel}
              surfaceDescription={surfaceDescription}
              surfaceStarters={surfaceStarters}
            />
          )}
          {history.map((message, index) => (
            <Bubble
              key={`${message.role}-${index}`}
              message={message}
              speechId={`helper-${conversationId ?? 'pending'}-${index}`}
              speakingId={speakingId}
              paused={paused}
              themeName={themeName}
              onSpeak={speak}
              onPause={() => {
                try {
                  window.speechSynthesis.pause()
                  setPaused(true)
                } catch {
                  // Ignore browser speech failures.
                }
              }}
              onResume={() => {
                try {
                  window.speechSynthesis.resume()
                  setPaused(false)
                } catch {
                  // Ignore browser speech failures.
                }
              }}
              onStop={stopSpeech}
            />
          ))}
          {running && <ThinkingBubble themeName={themeName} />}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
      </div>

      <form
        className={`flex items-end gap-2 border-t p-3 ${theme.border} ${theme.header}`}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder={placeholderForPill(activePillId)}
          rows={1}
          className={`max-h-32 min-h-10 flex-1 resize-none rounded-xl border px-3 py-2 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-blue-500/30 ${theme.input}`}
          style={{ fontFamily: SEEKLY_FONT }}
        />
        <button
          type="submit"
          disabled={running || !input.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-45"
          aria-label="Send Seekly message"
        >
          <Send className="h-4 w-4" />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`hidden rounded-xl border px-3 py-2 text-xs font-semibold sm:block ${theme.button}`}
          >
            Close
          </button>
        )}
      </form>
    </div>
  )
}

function Welcome({
  activePillId,
  onPick,
  themeName,
  surfaceLabel,
  surfaceDescription,
  surfaceStarters,
}: {
  activePillId: string
  onPick: (starter: string) => void
  themeName: SeeklyThemeName
  surfaceLabel?: string
  surfaceDescription?: string
  surfaceStarters: string[]
}) {
  const theme = themeForSeekly(themeName)
  const baselineStarters = STARTERS_BY_PILL[activePillId] ?? STARTERS_BY_PILL.features ?? []
  const starters =
    activePillId === 'help' || activePillId === 'features' || activePillId === 'support'
      ? [...surfaceStarters, ...baselineStarters].slice(0, 6)
      : baselineStarters
  const meta = INTENT_PILLS.find((pill) => pill.pillId === activePillId)

  return (
    <div className="flex flex-col items-center gap-4 px-2 py-3 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          color: theme.accent,
          backgroundColor: `${theme.accent}18`,
          borderColor: `${theme.accent}44`,
        }}
      >
        <Bot className="h-6 w-6" />
      </div>
      <div>
        <p className={`text-base font-bold ${theme.text}`} style={{ fontFamily: SEEKLY_FONT }}>
          {meta?.tagline ?? 'How can Seekly help?'}
        </p>
        <p className={`mt-1 text-[11px] ${theme.muted}`} style={{ fontFamily: SEEKLY_FONT }}>
          {surfaceLabel ? `${surfaceLabel} support` : 'Pick a starter or type your own.'}
        </p>
        {surfaceDescription ? (
          <p className={`mx-auto mt-2 max-w-sm text-[11px] leading-4 ${theme.muted}`} style={{ fontFamily: SEEKLY_FONT }}>
            {surfaceDescription}
          </p>
        ) : null}
      </div>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {starters.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onPick(starter)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] ${theme.button}`}
            style={{ fontFamily: SEEKLY_FONT }}
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({
  message,
  speechId,
  speakingId,
  paused,
  themeName,
  onSpeak,
  onPause,
  onResume,
  onStop,
}: {
  message: HelperMessage
  speechId: string
  speakingId: string | null
  paused: boolean
  themeName: SeeklyThemeName
  onSpeak: (id: string, text: string) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}) {
  const theme = themeForSeekly(themeName)
  const isUser = message.role === 'user'
  const tryMatch = !isUser ? TRY_RE.exec(message.content) : null
  const body = tryMatch ? message.content.replace(tryMatch[0], '').trim() : message.content
  const tryTopic = tryMatch?.[1] ? sanitizeTryTopic(tryMatch[1]) : ''
  const activeSpeech = speakingId === speechId
  const isPlaying = activeSpeech && !paused
  const isPaused = activeSpeech && paused

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="mt-6 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{
            color: theme.accent,
            backgroundColor: `${theme.accent}18`,
            borderColor: `${theme.accent}44`,
          }}
        >
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="max-w-[84%]">
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isPlaying) onPause()
                else if (isPaused) onResume()
                else onSpeak(speechId, body)
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-semibold ${theme.button}`}
              style={activeSpeech ? { borderColor: `${theme.accent}55`, color: theme.accent } : undefined}
            >
              {isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : isPaused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
              {isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Read aloud'}
            </button>
            {activeSpeech && (
              <button
                type="button"
                onClick={onStop}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${theme.button}`}
              >
                <Square className="h-2.5 w-2.5" />
                Stop
              </button>
            )}
          </div>
        )}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
            isUser ? theme.userBubble : `border ${theme.assistantBubble}`
          }`}
          style={{ fontFamily: SEEKLY_FONT }}
        >
          {body}
        </div>
        {tryTopic && (
          <button
            type="button"
            onClick={() => {
              helperStore.setOpen(false)
              window.location.href = `/cleanseek-x?q=${encodeURIComponent(tryTopic)}`
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold"
            style={{
              color: theme.accent,
              backgroundColor: `${theme.accent}14`,
              borderColor: `${theme.accent}44`,
            }}
          >
            Try it: "{tryTopic}"
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      {isUser && (
        <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${theme.button}`}>
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
}

function ThinkingBubble({ themeName }: { themeName: SeeklyThemeName }) {
  const theme = themeForSeekly(themeName)

  return (
    <div className="flex gap-2">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{
          color: theme.accent,
          backgroundColor: `${theme.accent}18`,
          borderColor: `${theme.accent}44`,
        }}
      >
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className={`rounded-2xl rounded-tl-md border px-3 py-2 text-[11px] ${theme.assistantBubble}`}>
        Seekly is thinking...
      </div>
    </div>
  )
}

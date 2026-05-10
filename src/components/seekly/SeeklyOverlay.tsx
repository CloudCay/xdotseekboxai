import { useRouterState } from '@tanstack/react-router'
import { Maximize2, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SeekBoxLogo } from '@/components/SeekBoxLogo'
import { buildXdotHelperPageContext, getXdotRouteSupport } from '@/lib/helper/siteProfile'
import { helperStore, useHelperStore } from '@/lib/helper/store'
import { getSupabaseClient } from '@/lib/supabase'
import { themeForSeekly } from './seeklyTheme'
import { SeeklyChat } from './SeeklyChat'
import { useDocumentTheme } from './useDocumentTheme'

const LS_KEY = 'seekly-panel-geometry-v1'
const DEFAULT_W = 420
const DEFAULT_H = 640
const MIN_W = 320
const MIN_H = 360
const MAX_W = 880
const MAX_H = 1000

type Geometry = {
  w: number
  h: number
  right: number
  bottom: number
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value))
}

function loadGeometry(): Geometry {
  if (typeof window === 'undefined') return { w: DEFAULT_W, h: DEFAULT_H, right: 16, bottom: 16 }
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Geometry>
      return {
        w: clamp(parsed.w ?? DEFAULT_W, MIN_W, MAX_W),
        h: clamp(parsed.h ?? DEFAULT_H, MIN_H, MAX_H),
        right: clamp(parsed.right ?? 16, 8, Math.max(8, window.innerWidth - MIN_W)),
        bottom: clamp(parsed.bottom ?? 16, 8, Math.max(8, window.innerHeight - 80)),
      }
    }
  } catch {
    // Keep default geometry.
  }
  return { w: DEFAULT_W, h: DEFAULT_H, right: 16, bottom: 16 }
}

function saveGeometry(geometry: Geometry) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(geometry))
  } catch {
    // Storage can be unavailable in private windows.
  }
}

export function SeeklyOverlay() {
  const isOpen = useHelperStore((state) => state.isOpen)
  const autoRead = useHelperStore((state) => state.autoRead)
  const themeName = useDocumentTheme()
  const theme = useMemo(() => themeForSeekly(themeName), [themeName])
  const location = useRouterState({ select: (state) => state.location })
  const routeSupport = useMemo(() => getXdotRouteSupport(location.pathname), [location.pathname])
  const [chatPrewarmed, setChatPrewarmed] = useState(false)
  const [geometry, setGeometry] = useState<Geometry>(() => loadGeometry())
  const dragRef = useRef<{ startX: number; startY: number; right: number; bottom: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null)

  useEffect(() => {
    helperStore.hydrateClientId()
    helperStore.hydrateAutoRead()
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => setChatPrewarmed(true), 1200)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!chatPrewarmed) return
    void getSupabaseClient()?.auth.getSession().catch(() => undefined)
  }, [chatPrewarmed])

  useEffect(() => {
    const search = location.search as Record<string, unknown>
    helperStore.setPageContext(
      buildXdotHelperPageContext({
        pathname: location.pathname,
        search,
      }),
    )
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault()
        helperStore.toggle()
      }
      if (event.key === 'Escape' && helperStore.isOpen) {
        helperStore.setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // Ignore browser speech failures.
      }
    }
  }, [isOpen])

  const onDragStart = (event: React.MouseEvent) => {
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      right: geometry.right,
      bottom: geometry.bottom,
    }
    const onMove = (moveEvent: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = moveEvent.clientX - drag.startX
      const dy = moveEvent.clientY - drag.startY
      setGeometry((current) => ({
        ...current,
        right: clamp(drag.right - dx, 8, Math.max(8, window.innerWidth - current.w - 8)),
        bottom: clamp(drag.bottom - dy, 8, Math.max(8, window.innerHeight - 80)),
      }))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setGeometry((current) => {
        saveGeometry(current)
        return current
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onResizeStart = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      w: geometry.w,
      h: geometry.h,
    }
    const onMove = (moveEvent: MouseEvent) => {
      const resize = resizeRef.current
      if (!resize) return
      setGeometry((current) => ({
        ...current,
        w: clamp(resize.w + resize.startX - moveEvent.clientX, MIN_W, MAX_W),
        h: clamp(resize.h + resize.startY - moveEvent.clientY, MIN_H, MAX_H),
      }))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setGeometry((current) => {
        saveGeometry(current)
        return current
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const mountPanel = isOpen || chatPrewarmed

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close Seekly backdrop"
          onClick={() => helperStore.setOpen(false)}
          className="fixed inset-0 z-[140] bg-black/35"
        />
      )}

      {mountPanel && (
        <aside
          aria-hidden={!isOpen}
          className={`fixed z-[150] flex min-h-0 max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border shadow-2xl ${
            theme.panel
          } ${theme.border}`}
          style={
            isOpen
              ? {
                  right: geometry.right,
                  bottom: geometry.bottom,
                  width: geometry.w,
                  height: geometry.h,
                  maxHeight: 'calc(100vh - 24px)',
                }
              : {
                  left: -12000,
                  top: 0,
                  width: geometry.w,
                  height: geometry.h,
                  opacity: 0,
                  pointerEvents: 'none',
                }
          }
        >
          {isOpen && (
            <>
              <button
                type="button"
                aria-label="Resize Seekly"
                onMouseDown={onResizeStart}
                className="absolute left-0 top-0 z-[152] flex h-5 w-5 cursor-nwse-resize items-center justify-center opacity-45"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
              <div
                onMouseDown={onDragStart}
                className={`flex cursor-grab select-none items-center gap-2 border-b px-4 py-3 ${theme.header} ${theme.border}`}
              >
                <SeekBoxLogo tone={theme.logoTone} size="sm" />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-black ${theme.text}`}>Seekly</p>
                  <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.18em] ${theme.muted}`}>
                    {routeSupport.label}
                  </p>
                </div>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => helperStore.setAutoRead(!autoRead)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                    autoRead ? 'border-blue-500/50 bg-blue-500/15 text-blue-500' : theme.button
                  }`}
                  aria-label={autoRead ? 'Turn off auto-read' : 'Turn on auto-read'}
                >
                  {autoRead ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => helperStore.setOpen(false)}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${theme.button}`}
                  aria-label="Close Seekly"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          <SeeklyChat
            themeName={themeName}
            surfaceLabel={routeSupport.label}
            surfaceDescription={routeSupport.description}
            surfaceStarters={routeSupport.starters}
          />
        </aside>
      )}

      <button
        type="button"
        onClick={() => helperStore.toggle()}
        aria-label={isOpen ? 'Close Seekly' : 'Open Seekly'}
        className={`fixed bottom-4 right-4 z-[160] flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-xl transition ${
          isOpen ? 'pointer-events-none opacity-0' : 'opacity-100 hover:scale-[1.02]'
        } ${theme.header} ${theme.border}`}
      >
        <SeekBoxLogo tone={theme.logoTone} size="lg" className="rounded-full border-0 shadow-none" />
      </button>
    </>
  )
}

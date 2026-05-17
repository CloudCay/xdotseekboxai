import { useEffect, useRef, useState } from 'react'
import { Cpu, Play, RotateCcw } from 'lucide-react'

export type EngineStatus = 'idle' | 'thinking' | 'done'

export type MatrixEngine = {
  id: string
  name: string
  model?: string
  color: string
  highlight?: string
  status: EngineStatus
}

export type MatrixProps = {
  engines: MatrixEngine[]
  height?: number
  onAllDone?: () => void
  doneMessage?: string
  className?: string
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*<>?/{}[]|+=-'.split('')
const FONT_SIZE = 16
const COL_WIDTH = FONT_SIZE
const STAGE_BG = '#05080c'

export const DEFAULT_MATRIX_ENGINES: MatrixEngine[] = [
  { id: 'gpt', name: 'GPT', model: 'reasoning', color: '#10a37f', highlight: '#5fffd0', status: 'idle' },
  { id: 'claude', name: 'Claude', model: 'analysis', color: '#d97706', highlight: '#ffd99e', status: 'idle' },
  { id: 'gemini', name: 'Gemini', model: 'fast scan', color: '#4285f4', highlight: '#a8c7ff', status: 'idle' },
  { id: 'live-x', name: 'Live X', model: 'x search', color: '#aab1bc', highlight: '#ffffff', status: 'idle' },
  { id: 'brave', name: 'Brave', model: 'web search', color: '#8b5cf6', highlight: '#d4c4ff', status: 'idle' },
]

export function Matrix({
  engines,
  height = 460,
  onAllDone,
  doneMessage,
  className,
}: MatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const enginesRef = useRef<MatrixEngine[]>(engines)
  const allDoneFiredRef = useRef(false)
  const colStateRef = useRef<Array<{ y: number; speed: number }>>([])

  enginesRef.current = engines

  useEffect(() => {
    if (engines.some((engine) => engine.status !== 'done')) allDoneFiredRef.current = false
  }, [engines])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onResize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      const ctx = canvas.getContext('2d')
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cols = Math.max(1, Math.floor(rect.width / COL_WIDTH))
      colStateRef.current = Array.from({ length: cols }, () => ({
        y: Math.random() * (rect.height / FONT_SIZE),
        speed: 0.4 + Math.random() * 0.9,
      }))
    }

    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const tick = () => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const heightPx = rect.height
      const liveEngines = enginesRef.current
      const anyThinking = liveEngines.some((engine) => engine.status === 'thinking')
      const allDone = liveEngines.length > 0 && liveEngines.every((engine) => engine.status === 'done')

      if (allDone && !allDoneFiredRef.current) {
        allDoneFiredRef.current = true
        onAllDone?.()
      }

      ctx.fillStyle = `rgba(5, 8, 12, ${anyThinking ? 0.08 : allDone ? 0.04 : 0.18})`
      ctx.fillRect(0, 0, width, heightPx)
      ctx.font = `${FONT_SIZE}px "JetBrains Mono", "Fira Code", Menlo, monospace`
      ctx.textBaseline = 'top'

      const cols = colStateRef.current
      const bandCount = liveEngines.length || 1
      const colsPerBand = cols.length / bandCount

      cols.forEach((col, columnIndex) => {
        const bandIdx = Math.min(bandCount - 1, Math.floor(columnIndex / colsPerBand))
        const band = liveEngines[bandIdx]
        if (!band) return
        if (band.status === 'idle' && Math.random() > 0.4) return
        if (band.status === 'done' && Math.random() > 0.65) return

        const x = columnIndex * COL_WIDTH
        const yPx = col.y * FONT_SIZE
        const ch = CHARS[(Math.random() * CHARS.length) | 0] || '0'
        ctx.fillStyle = band.highlight ?? band.color
        ctx.fillText(ch, x, yPx)

        if (col.y > 1) {
          ctx.fillStyle = band.color
          ctx.fillText(CHARS[(Math.random() * CHARS.length) | 0] || '1', x, (col.y - 1) * FONT_SIZE)
        }

        col.y += col.speed
        if (col.y * FONT_SIZE > heightPx && Math.random() > 0.975) {
          col.y = -Math.random() * 8
          col.speed = 0.4 + Math.random() * 0.9
        }
      })

      liveEngines.forEach((band, index) => {
        if (band.status === 'idle' || !band.model || Math.random() > 0.012) return
        const bandX0 = index * (width / bandCount)
        const bandX1 = (index + 1) * (width / bandCount)
        const x = bandX0 + Math.random() * Math.max(20, bandX1 - bandX0 - 180)
        const y = Math.random() * (heightPx - 30) + 20
        ctx.font = `bold ${FONT_SIZE - 1}px "JetBrains Mono", Menlo, monospace`
        ctx.fillStyle = band.highlight ?? band.color
        ctx.fillText(band.model, x, y)
        ctx.font = `${FONT_SIZE}px "JetBrains Mono", "Fira Code", Menlo, monospace`
      })

      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationRef.current)
  }, [onAllDone])

  const allDone = engines.length > 0 && engines.every((engine) => engine.status === 'done')

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        height,
        background: STAGE_BG,
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
        aria-label="Parallel model loading animation"
      />
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${engines.length || 1}, 1fr)`,
          pointerEvents: 'none',
        }}
      >
        {engines.map((engine) => (
          <div
            key={engine.id}
            style={{
              minWidth: 0,
              padding: '10px 12px',
              fontSize: 10,
              fontFamily: '"JetBrains Mono", Menlo, monospace',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: engine.color,
            }}
          >
            {engine.name}
          </div>
        ))}
      </div>
      {allDone && doneMessage ? (
        <div
          style={{
            position: 'absolute',
            insetInline: 0,
            bottom: 0,
            padding: '12px 24px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#5fffd0',
            background: 'linear-gradient(180deg, rgba(5,8,12,0) 0%, rgba(5,8,12,0.9) 100%)',
          }}
        >
          {doneMessage}
        </div>
      ) : null}
    </div>
  )
}

export function MatrixDemo({
  engines: initialEngines = DEFAULT_MATRIX_ENGINES,
  minThinkMs = 2500,
  maxThinkMs = 5000,
  doneMessage = 'Minds resolved. Ready to synthesize.',
  height = 460,
  autoStart = false,
}: {
  engines?: MatrixEngine[]
  minThinkMs?: number
  maxThinkMs?: number
  doneMessage?: string
  height?: number
  autoStart?: boolean
}) {
  const [engines, setEngines] = useState<MatrixEngine[]>(() => initialEngines.map((engine) => ({ ...engine, status: 'idle' })))
  const [running, setRunning] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const reset = () => {
    clearTimers()
    setEngines(initialEngines.map((engine) => ({ ...engine, status: 'idle' })))
    setRunning(false)
    setAllDone(false)
  }

  const start = () => {
    if (running) return
    clearTimers()
    setAllDone(false)
    setRunning(true)
    setEngines((prev) => prev.map((engine) => ({ ...engine, status: 'thinking' })))
    initialEngines.forEach((_, index) => {
      const ms = minThinkMs + Math.random() * Math.max(0, maxThinkMs - minThinkMs)
      const timer = setTimeout(() => {
        setEngines((prev) => prev.map((engine, idx) => (idx === index ? { ...engine, status: 'done' } : engine)))
      }, ms)
      timersRef.current.push(timer)
    })
  }

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    if (autoStart) start()
  }, [autoStart])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {engines.map((engine) => (
            <EnginePill key={engine.id} engine={engine} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={start} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            <Play className="h-4 w-4" />
            {running ? 'Thinking' : allDone ? 'Run again' : 'Start'}
          </button>
          {(running || allDone) ? (
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-800">
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          ) : null}
        </div>
      </div>
      <Matrix engines={engines} height={height} onAllDone={() => { setRunning(false); setAllDone(true) }} doneMessage={doneMessage} />
      <div className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-white p-3 text-xs font-semibold leading-5 text-neutral-600">
        <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-neutral-900" />
        <span>Demo wrapper only. In production, drive each band from the real request state.</span>
      </div>
    </div>
  )
}

function EnginePill({ engine }: { engine: MatrixEngine }) {
  const label = engine.status === 'idle' ? 'Idle' : engine.status === 'thinking' ? 'Thinking' : 'Resolved'
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-black"
      style={{
        background: `${engine.color}1a`,
        borderColor: `${engine.color}55`,
        color: engine.color,
        fontFamily: '"JetBrains Mono", Menlo, monospace',
      }}
      title={engine.model}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: engine.status === 'idle' ? `${engine.color}66` : engine.color,
          animation: engine.status === 'thinking' ? 'xi-pulse 1s ease-in-out infinite' : undefined,
        }}
      />
      {engine.name}
      <span style={{ opacity: 0.65 }}>{label}</span>
    </span>
  )
}

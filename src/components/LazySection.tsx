import { useEffect, useRef, useState, type ReactNode } from 'react'

type LazySectionProps = {
  children: ReactNode
  className?: string
  label?: string
  placeholderHeight?: number
  rootMargin?: string
}

export function LazySection({
  children,
  className = '',
  label = 'Loading section',
  placeholderHeight = 260,
  rootMargin = '900px',
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (shouldRender) return
    const timeout = window.setTimeout(() => setShouldRender(true), 2400)
    const target = ref.current

    if (!target || typeof IntersectionObserver === 'undefined') {
      return () => window.clearTimeout(timeout)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setShouldRender(true)
        window.clearTimeout(timeout)
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(target)
    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [rootMargin, shouldRender])

  return (
    <div ref={ref} className={className}>
      {shouldRender ? (
        children
      ) : (
        <div
          aria-hidden="true"
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          style={{ minHeight: placeholderHeight }}
        >
          <div className="h-full min-h-32 border border-dashed border-neutral-300 bg-white/60 px-5 py-5 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
            {label}
          </div>
        </div>
      )}
    </div>
  )
}

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Gift, LockKeyhole, Mail, Star, X, Zap } from 'lucide-react'
import { formatAuthError } from '../lib/authErrors'
import { collectClientSignals, recordVisit, type ClientSignals } from '../lib/inboundVisits'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import { getVariantForSignals, type SplashVariant } from '../lib/splashVariants'

const welcomedKey = 'sbx_welcomed'
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AnonSplashGateProps = {
  authChecked: boolean
  signedIn: boolean
  limitOpen: boolean
  searchCount: number
  searchLimit: number
  returnTo?: string
  onLimitClose: () => void
}

function safeReturnTo(explicit?: string): string {
  if (explicit && explicit.startsWith('/') && !explicit.startsWith('//')) return explicit
  if (typeof window === 'undefined') return '/cleanseek-x'
  const current = `${window.location.pathname}${window.location.search}`
  return current.startsWith('/') && !current.startsWith('//') ? current : '/cleanseek-x'
}

function navigateTo(href: string): void {
  if (href.startsWith('/')) {
    window.location.href = href
    return
  }
  window.location.assign(href)
}

export function AnonSplashGate({
  authChecked,
  signedIn,
  limitOpen,
  searchCount,
  searchLimit,
  returnTo,
  onLimitClose,
}: AnonSplashGateProps) {
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [variant, setVariant] = useState<SplashVariant | null>(null)
  const [signals, setSignals] = useState<ClientSignals | null>(null)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [emailError, setEmailError] = useState<string | null>(null)
  const shownKeysRef = useRef(new Set<string>())
  const safePath = useMemo(() => safeReturnTo(returnTo), [returnTo])

  useEffect(() => {
    if (!authChecked || signedIn) {
      setWelcomeOpen(false)
      if (limitOpen) onLimitClose()
      return
    }
    if (typeof window === 'undefined') return

    const shouldShowWelcome = !limitOpen && !window.localStorage.getItem(welcomedKey)
    if (!limitOpen && !shouldShowWelcome) return

    let cancelled = false
    void (async () => {
      const collected = collectClientSignals()
      const selected = await getVariantForSignals({
        ref: collected.ref_explicit,
        utm_source: collected.utm_source,
        ua: collected.ua_raw,
        referer_host: collected.referer_host,
      })
      if (cancelled) return

      const reason = limitOpen ? 'limit' : 'welcome'
      setSignals(collected)
      setVariant(selected)
      if (shouldShowWelcome) setWelcomeOpen(true)

      const shownKey = `${selected.id}:${reason}`
      if (!shownKeysRef.current.has(shownKey)) {
        shownKeysRef.current.add(shownKey)
        void recordVisit({ signals: collected, variantId: selected.id, action: 'shown' })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authChecked, limitOpen, onLimitClose, signedIn])

  const visible = Boolean(variant) && (limitOpen || welcomeOpen)
  const reason: 'limit' | 'welcome' = limitOpen ? 'limit' : 'welcome'

  const markWelcomedAndHide = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(welcomedKey, '1')
    setWelcomeOpen(false)
    setEmailError(null)
    setEmailStatus('idle')
  }

  const handleSecondary = async () => {
    if (!variant || !signals) {
      markWelcomedAndHide()
      return
    }

    await recordVisit({
      signals,
      variantId: variant.id,
      action: variant.secondary_href ? 'navigate_secondary' : 'try_search',
    })
    markWelcomedAndHide()
    if (variant.secondary_href) navigateTo(variant.secondary_href)
  }

  const handlePrimaryNavigate = async () => {
    const signInHref = `/signin?returnTo=${encodeURIComponent(safePath)}`
    if (!variant || !signals) {
      navigateTo(signInHref)
      return
    }

    await recordVisit({ signals, variantId: variant.id, action: 'navigate_primary' })
    if (reason === 'welcome') window.localStorage.setItem(welcomedKey, '1')
    navigateTo(reason === 'limit' ? signInHref : variant.primary_href || signInHref)
  }

  const handleMagicPrimary = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!variant || !signals) return

    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setEmailError('Please enter your email address.')
      return
    }
    if (!emailRegex.test(trimmed)) {
      setEmailError('Please enter a valid email address.')
      return
    }

    if (!isSupabaseConfigured) {
      setEmailError('Sign-in is not configured in this environment.')
      return
    }

    const sb = getSupabaseClient()
    if (!sb) {
      setEmailError('Sign-in is not available right now.')
      return
    }

    setEmailError(null)
    setEmailStatus('sending')
    try {
      await recordVisit({ signals, variantId: variant.id, action: 'submit_email', email: trimmed })
      const callback = new URL('/signin', window.location.origin)
      callback.searchParams.set('returnTo', safePath)
      const { error } = await sb.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: callback.toString(),
          shouldCreateUser: true,
        },
      })
      if (error) throw error
      setEmailStatus('sent')
      if (reason === 'welcome') window.localStorage.setItem(welcomedKey, '1')
    } catch (err) {
      setEmailError(formatAuthError(err))
      setEmailStatus('idle')
    }
  }

  if (!visible || !variant) return null

  const Icon = reason === 'limit' ? LockKeyhole : variant.icon === 'gift' ? Gift : variant.icon === 'star' ? Star : Zap
  const title = reason === 'limit' ? `You used your ${searchLimit} anonymous searches` : variant.headline
  const body =
    reason === 'limit'
      ? 'Sign in to keep searching, save your history, and unlock the full SeekBox workspace.'
      : variant.sub
  const bullets =
    reason === 'limit'
      ? [
          'Continue with a free account instead of resetting your session',
          'Save search history and reopen past comparisons',
          'Upgrade only when you need higher limits or team features',
        ]
      : variant.bullets
  const primaryLabel = reason === 'limit' ? 'Sign in to keep searching' : variant.primary_label
  const isMagic = variant.mode === 'magic'
  const usedLabel = Math.min(searchCount, searchLimit).toLocaleString()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 px-4 py-6 backdrop-blur-md" role="presentation">
      <section
        className="relative w-full max-w-lg border border-neutral-900 bg-[#f7f8f4] p-5 text-neutral-950 shadow-[10px_10px_0_rgba(0,0,0,0.35)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-splash-title"
      >
        {reason === 'welcome' ? (
          <button
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center border border-neutral-300 bg-white text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
            type="button"
            aria-label="Close welcome"
            onClick={markWelcomedAndHide}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex items-start gap-4 pr-10">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-neutral-950 bg-neutral-950 text-cyan-200">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
              {reason === 'limit' ? `${usedLabel}/${searchLimit} session searches` : 'Welcome to SeekBox'}
            </div>
            <h2 id="anon-splash-title" className="mt-2 text-2xl font-black leading-tight tracking-normal text-neutral-950 sm:text-3xl">
              {title}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-neutral-700">{body}</p>

        {bullets.length ? (
          <ul className="mt-4 space-y-2 text-sm text-neutral-800">
            {bullets.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-cyan-500" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {isMagic ? (
          <form className="mt-5" onSubmit={handleMagicPrimary}>
            <label htmlFor="anon-splash-email" className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Email
            </label>
            <div className="mt-2 flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 focus-within:border-neutral-950">
              <Mail className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                id="anon-splash-email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-neutral-950 outline-none placeholder:text-neutral-400"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
            </div>
            {emailStatus === 'sent' ? (
              <div className="mt-2 border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Link sent to {email.trim()}.
              </div>
            ) : null}
            {emailError ? (
              <div className="mt-2 border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{emailError}</div>
            ) : null}
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-black text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={emailStatus === 'sending' || emailStatus === 'sent'}
              type="submit"
            >
              <ArrowRight className="h-4 w-4" />
              {emailStatus === 'sending' ? 'Sending...' : primaryLabel}
            </button>
          </form>
        ) : (
          <button
            className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-black text-white hover:bg-neutral-800"
            type="button"
            onClick={() => void handlePrimaryNavigate()}
          >
            <ArrowRight className="h-4 w-4" />
            {primaryLabel}
          </button>
        )}

        {variant.helper_text ? <div className="mt-3 text-xs font-semibold text-neutral-500">{variant.helper_text}</div> : null}

        {reason === 'welcome' ? (
          <button
            className="mt-3 w-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-black text-neutral-800 hover:border-neutral-950"
            type="button"
            onClick={() => void handleSecondary()}
          >
            {variant.secondary_label}
          </button>
        ) : (
          <a
            className="mt-3 block w-full border border-neutral-300 bg-white px-4 py-2.5 text-center text-sm font-black text-neutral-800 hover:border-neutral-950"
            href="/pricing"
          >
            See plans
          </a>
        )}

        {variant.footer_text ? <div className="mt-3 text-[11px] font-semibold text-neutral-500">{variant.footer_text}</div> : null}
      </section>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

// If the Turnstile script loads before React effects run (e.g. due to preloading/caching),
// Cloudflare will look for the `onload` callback name immediately. Provide a stub early so
// the script never errors while our component hydrates and the library wires up its promise.
if (typeof window !== 'undefined') {
  const w = window as any
  if (typeof w.onloadTurnstileCallback !== 'function') w.onloadTurnstileCallback = () => {}
}

function formatAuthError(err: unknown): string {
  if (!err) return 'Sign-in failed. Please try again.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    const msg = typeof anyErr.message === 'string' && anyErr.message.trim() ? anyErr.message.trim() : null
    const status = typeof anyErr.status === 'number' ? anyErr.status : null
    const code = typeof anyErr.code === 'string' && anyErr.code.trim() ? anyErr.code.trim() : null
    const name = typeof anyErr.name === 'string' && anyErr.name.trim() ? anyErr.name.trim() : null
    const parts = [
      msg ?? 'Sign-in failed. Please try again.',
      status != null ? `status ${status}` : null,
      code ? `code ${code}` : null,
      name ? `(${name})` : null,
    ].filter(Boolean)
    const joined = parts.join(' · ')

    // Add one targeted hint for the most common “mysterious 400”.
    if (status === 400 && msg && /api key|invalid api key|jwt/i.test(msg)) {
      return `${joined}\n\nHint: this usually means the Supabase anon key or URL is wrong/rotated. Update VITE_SUPABASE_ANON_KEY + VITE_SUPABASE_URL in Netlify and redeploy.`
    }
    if (status === 400 && msg && /redirect/i.test(msg)) {
      return `${joined}\n\nHint: check Supabase Auth “Redirect URLs” / “Site URL” for this deployment origin.`
    }
    if (msg && /captcha/i.test(msg)) {
      return `${joined}\n\nHint: Supabase is requiring captcha. Ensure Turnstile is enabled and VITE_TURNSTILE_SITE_KEY is set (or disable captcha enforcement in Supabase Auth settings).`
    }
    return joined
  }
  return 'Sign-in failed. Please try again.'
}

// Vite only exposes VITE_* vars to the browser bundle.
// Support both so you can share naming with the main app, but use VITE_ on this site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite env access
const TURNSTILE_SITE_KEY =
  ((import.meta as any)?.env?.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ||
  (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim()
const CAPTCHA_REQUIRED = Boolean(TURNSTILE_SITE_KEY)

export const Route = createFileRoute('/signin')({
  component: SignInPage,
})

function SignInPage() {
  const sb = isSupabaseConfigured ? supabase : null
  if (!sb) {
    return (
      <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
          <div className="text-2xl font-black tracking-tight">Sign in</div>
          <div className="mt-3 text-slate-300">
            Sign-in isn’t enabled on this site yet.
          </div>
          <div className="mt-6 text-sm text-slate-400">
            To enable it, set <span className="font-mono">EXPO_PUBLIC_SUPABASE_URL</span> and{' '}
            <span className="font-mono">EXPO_PUBLIC_SUPABASE_ANON_KEY</span> in Netlify and redeploy.
          </div>
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-5 py-3"
          >
            Back to home
          </a>
        </div>
      </div>
    )
  }

  const [email, setEmail] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const [isAuthed, setIsAuthed] = useState<boolean>(false)
  const [turnstileFailed, setTurnstileFailed] = useState<boolean>(false)
  const [turnstileWidgetLoaded, setTurnstileWidgetLoaded] = useState<boolean>(false)

  useEffect(() => setIsHydrated(true), [])

  const returnTo = useMemo(() => {
    if (typeof window === 'undefined') return '/cleanseek-x'
    try {
      const sp = new URLSearchParams(window.location.search)
      const rt = (sp.get('returnTo') ?? '').trim()
      if (rt.startsWith('/') && !rt.startsWith('//')) return rt
    } catch {
      // ignore
    }
    return '/cleanseek-x'
  }, [])

  const getRedirectTo = () => {
    if (typeof window === 'undefined') return undefined
    // Return directly to the intended in-app destination on the *current* origin.
    // This avoids relying on Supabase "Site URL" fallback and reduces allowlist complexity.
    return `${window.location.origin}${returnTo}`
  }

  // If the Turnstile script/widget is blocked, onError may never fire.
  // Don't brick sign-in: after a short grace period, allow proceeding and let
  // Supabase enforce captcha server-side if required.
  useEffect(() => {
    if (!CAPTCHA_REQUIRED) return
    if (captchaToken) return
    if (turnstileFailed) return

    const t = setTimeout(() => {
      if (!captchaToken) setTurnstileFailed(true)
    }, 8000)

    return () => clearTimeout(t)
  }, [captchaToken, turnstileFailed])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const has = Boolean(data.session?.user?.id)
        if (!cancelled) setIsAuthed(has)
        if (has && typeof window !== 'undefined') {
          window.location.href = returnTo
        }
      } catch {
        if (!cancelled) setIsAuthed(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [returnTo])

  const signInWithGoogle = async () => {
    setError(null)
    setIsGoogleLoading(true)
    try {
      const redirectTo = getRedirectTo()
      const { error: authError } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })
      if (authError) throw authError
      // Browser will redirect out to Google automatically.
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const sendLink = async () => {
    const e = email.trim().toLowerCase()
    if (!e) {
      setError('Please enter your email.')
      return
    }
    if (CAPTCHA_REQUIRED && !captchaToken && !turnstileFailed) {
      setError('Please complete the security check.')
      return
    }
    setError(null)
    setStatus('sending')
    try {
      const emailRedirectTo = getRedirectTo()
      const { error: authError } = await sb.auth.signInWithOtp({
        email: e,
        options: {
          emailRedirectTo,
          captchaToken: captchaToken ?? undefined,
          shouldCreateUser: true,
        },
      })
      if (authError) throw authError
      setStatus('sent')
    } catch (err) {
      const msg = formatAuthError(err)
      if (/captcha/i.test(msg) && !CAPTCHA_REQUIRED) {
        setError(
          'Captcha is required, but Turnstile is not configured on this site. Set VITE_TURNSTILE_SITE_KEY in Netlify and redeploy.',
        )
      } else {
        setError(msg)
      }
      if (CAPTCHA_REQUIRED) {
        setCaptchaToken(null)
        turnstileRef.current?.reset()
      }
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
        <div className="text-2xl font-black tracking-tight">Sign in</div>
        <div className="mt-2 text-slate-300">
          Enter your email and we’ll send a secure magic link.
        </div>
        <div className="mt-2 text-xs text-slate-500">
          After signing in you’ll return to <span className="font-mono">{returnTo}</span>.
        </div>

        {isAuthed ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            You’re signed in. Redirecting…
          </div>
        ) : null}

        <button
          onClick={signInWithGoogle}
          disabled={isGoogleLoading}
          className="mt-6 w-full rounded-2xl border border-slate-700 bg-slate-900/40 text-white font-black px-6 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="mt-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-slate-800" />
          <div>or</div>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {isHydrated && CAPTCHA_REQUIRED ? (
          <div className="mt-6 flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onWidgetLoad={() => setTurnstileWidgetLoaded(true)}
              onLoadScript={() => setTurnstileWidgetLoaded(true)}
              onSuccess={(token) => {
                setCaptchaToken(token)
                setTurnstileFailed(false)
              }}
              onError={() => {
                setCaptchaToken(null)
                setTurnstileFailed(true)
              }}
              onTimeout={() => {
                setCaptchaToken(null)
                setTurnstileFailed(true)
              }}
              onUnsupported={() => {
                setCaptchaToken(null)
                setTurnstileFailed(true)
              }}
              onExpire={() => {
                setCaptchaToken(null)
                turnstileRef.current?.reset()
              }}
              options={{ theme: 'auto', size: 'flexible' }}
              scriptOptions={{
                onLoadCallbackName: 'onloadTurnstileCallback',
                onError: () => {
                  setCaptchaToken(null)
                  setTurnstileFailed(true)
                },
              }}
            />
          </div>
        ) : null}

        {CAPTCHA_REQUIRED && turnstileFailed ? (
          <div className="mt-4 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            Verification isn’t loading on this browser/network. You can still try to sign in — if verification is required for your
            account, we’ll show the exact error.
          </div>
        ) : null}

        {CAPTCHA_REQUIRED && !turnstileFailed && turnstileWidgetLoaded && !captchaToken ? (
          <div className="mt-4 text-xs text-slate-400">Verifying…</div>
        ) : null}

        <div className="mt-6">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0A1128]/80 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all backdrop-blur-md text-lg"
          />
        </div>

        {error ? (
          <div className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        ) : null}

        {status === 'sent' ? (
          <div className="mt-6 text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            Link sent to <span className="font-bold">{email.trim()}</span>. Open it to continue.
          </div>
        ) : (
          <button
            onClick={sendLink}
            disabled={status === 'sending' || (CAPTCHA_REQUIRED && !captchaToken && !turnstileFailed)}
            className="mt-6 w-full rounded-2xl bg-cyan-500 text-[#050B14] font-black px-6 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        )}

        <a
          href={returnTo}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/30 px-6 py-4 text-sm font-bold text-slate-200"
        >
          Back
        </a>
      </div>
    </div>
  )
}


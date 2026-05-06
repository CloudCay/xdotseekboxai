import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

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
  if (!isSupabaseConfigured || !supabase) {
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

  const redirectTo = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    // After auth, return to this /signin route so we can redirect to `returnTo`.
    // IMPORTANT: do NOT use a "canonical" site URL override here. If it points
    // at a different app (e.g. seekboxai.com), Supabase may fail to exchange
    // the provider code and the user will see "Unable to exchange external code".
    return `${window.location.origin}/signin?returnTo=${encodeURIComponent(returnTo)}`
  }, [returnTo])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
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
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })
      if (authError) throw authError
      // Browser will redirect out to Google automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.')
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
    if (CAPTCHA_REQUIRED && !captchaToken) {
      setError('Please complete the security check.')
      return
    }
    setError(null)
    setStatus('sending')
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          emailRedirectTo: redirectTo,
          captchaToken: captchaToken ?? undefined,
          shouldCreateUser: true,
        },
      })
      if (authError) throw authError
      setStatus('sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send link. Please try again.'
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
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setCaptchaToken(null)}
              onExpire={() => {
                setCaptchaToken(null)
                turnstileRef.current?.reset()
              }}
              options={{ theme: 'auto', size: 'flexible' }}
            />
          </div>
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
            disabled={status === 'sending' || (CAPTCHA_REQUIRED && !captchaToken)}
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


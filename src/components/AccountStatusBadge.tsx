import { useEffect, useState } from 'react'
import { LogIn, UserRound } from 'lucide-react'
import {
  getAccountProfileSummary,
  getLocalAccountProfileSummary,
  type AccountProfileSummary,
} from '../lib/accountProfileSummary'
import { ensureAccount } from '../lib/ensureAccount'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

type AccountStatusBadgeProps = {
  tone?: 'light' | 'dark'
  className?: string
}

export function AccountStatusBadge({ tone = 'light', className = '' }: AccountStatusBadgeProps) {
  const [summary, setSummary] = useState<AccountProfileSummary>(() => getLocalAccountProfileSummary())
  const [returnTo, setReturnTo] = useState('/')

  useEffect(() => {
    if (typeof window === 'undefined') return
    setReturnTo(`${window.location.pathname}${window.location.search}`)
    const sb = isSupabaseConfigured ? getSupabaseClient() : null
    let cancelled = false

    const refresh = async () => {
      setReturnTo(`${window.location.pathname}${window.location.search}`)
      try {
        const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } }
        const user = data.session?.user ?? null
        if (user) {
          try {
            await ensureAccount(user)
          } catch {
            // Account sync should not hide the signed-in badge.
          }
        }
        const next = await getAccountProfileSummary({ supabase: sb, user: user as any })
        if (!cancelled) setSummary(next)
      } catch {
        if (!cancelled) setSummary(getLocalAccountProfileSummary())
      }
    }

    void refresh()
    const authSub = sb?.auth.onAuthStateChange(() => {
      void refresh()
    })
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('sb-session-searches-changed', refresh)

    return () => {
      cancelled = true
      authSub?.data.subscription.unsubscribe()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('sb-session-searches-changed', refresh)
    }
  }, [])

  const signedIn = summary.signedIn
  const status = signedIn ? 'Signed in' : 'Not signed in'
  const primary = signedIn ? summary.displayName ?? summary.email ?? 'Signed in' : 'Anonymous'
  const secondary = [
    summary.roleLabel,
    summary.searchesLeft !== null ? `${summary.searchesLeft} left` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const initials = summary.avatarInitial ?? (signedIn ? 'U' : 'A')
  const href = signedIn ? '/account' : `/signin?returnTo=${encodeURIComponent(returnTo)}`

  const chrome =
    tone === 'dark'
      ? {
          wrap: 'border-slate-700/80 bg-[#0A1128]/80 text-slate-100',
          avatar: 'border-cyan-300/25 bg-cyan-500/20 text-cyan-100',
          label: 'text-slate-100',
          muted: 'text-slate-400',
          pill: signedIn
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
            : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
          action: signedIn
            ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800/70'
            : 'border-cyan-400/35 bg-cyan-400 text-[#050B14] hover:bg-cyan-300',
          tip: 'border-slate-700 bg-[#08111F] text-slate-100 shadow-black/40',
          tipMuted: 'text-slate-400',
        }
      : {
          wrap: 'border-neutral-300 bg-white text-neutral-950 shadow-[3px_3px_0_rgba(0,0,0,0.05)]',
          avatar: 'border-neutral-300 bg-[#f7f8f4] text-neutral-950',
          label: 'text-neutral-950',
          muted: 'text-neutral-500',
          pill: signedIn
            ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800'
            : 'border-cyan-700/25 bg-cyan-50 text-cyan-800',
          action: signedIn
            ? 'border-neutral-300 bg-[#f7f8f4] text-neutral-800 hover:border-neutral-950'
            : 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800',
          tip: 'border-neutral-800 bg-neutral-950 text-white shadow-black/20',
          tipMuted: 'text-neutral-300',
        }

  return (
    <div className={`group relative flex h-11 max-w-full shrink-0 items-center gap-2 rounded-2xl border px-2.5 ${chrome.wrap} ${className}`}>
      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm font-black ${chrome.avatar}`}>
        {initials}
      </span>
      <div className="hidden min-w-0 xl:block">
        <div className={`max-w-[150px] truncate text-xs font-black ${chrome.label}`} title={summary.email ?? primary}>
          {primary}
        </div>
        <div className={`mt-0.5 flex flex-nowrap items-center gap-1 text-[10px] font-black uppercase tracking-wide ${chrome.muted}`}>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${chrome.pill}`}>
            <UserRound className="h-3 w-3" />
            {status}
          </span>
          {secondary ? <span className="max-w-[160px] truncate normal-case tracking-normal">{secondary}</span> : null}
        </div>
      </div>
      <a
        href={href}
        className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-black ${chrome.action}`}
      >
        {!signedIn ? <LogIn className="h-3.5 w-3.5" /> : null}
        <span className="hidden xl:inline">{signedIn ? 'Account' : 'Sign in'}</span>
        <span className="xl:hidden">{signedIn ? 'Acct' : 'In'}</span>
      </a>
      <div className={`pointer-events-none absolute right-0 top-full z-50 mt-3 hidden w-72 rounded-2xl border p-4 text-left shadow-2xl group-hover:block ${chrome.tip}`}>
        <div className="text-xs font-black uppercase tracking-[0.2em]">{status}</div>
        <p className={`mt-1 truncate text-xs font-bold ${chrome.tipMuted}`}>{summary.email ?? 'Anonymous session'}</p>
        <div className="mt-3 space-y-2">
          {summary.tooltipLines.map((line) => (
            <p key={line} className={`text-xs leading-5 ${chrome.tipMuted}`}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

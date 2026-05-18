import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  BookOpen,
  Clock,
  CreditCard,
  Database,
  HelpCircle,
  History,
  Library,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  UserRound,
  Wand,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { ensureAccount } from '../lib/ensureAccount'
import { XSiteHeader } from '../components/XSiteHeader'
import {
  applySiteFontToDocument,
  applySiteThemeToDocument,
  readSiteFontScale,
  readSiteTheme,
  SITE_THEME_OPTIONS,
  siteFontPx,
  writeSiteFontScale,
  writeSiteTheme,
  type SiteFontScale,
  type SiteThemeMode,
} from '../lib/siteTheme'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  defaultLensForLevel,
  loadPersonalizationSeed,
  personalizationLevelForRole,
  personalizationLevelLabel,
  savePersonalizationSeed,
  type PersonalizationSeed,
} from '../lib/personalization'

export const Route = createFileRoute('/account')({
  component: AccountPage,
})

type SubscriptionRow = {
  plan?: string | null
  status?: string | null
  created_at?: string | null
}

type AccountRow = {
  id?: string | null
  role?: string | null
  granted_role?: string | null
  role_id?: string | null
  trial_ends_at?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

function normalizeRoleForDisplay(raw: string | null | undefined, email: string | null): string | null {
  const role = raw?.trim()
  if (!role) return null
  if (role === 'guest') return email ? 'trial' : 'anon'
  if (email && role === 'anon') return 'trial'
  return role
}

function stringifyErr(e: unknown): string {
  if (e && typeof e === 'object') {
    const anyE = e as any
    const parts: string[] = []
    if (typeof anyE.message === 'string' && anyE.message.trim()) parts.push(anyE.message.trim())
    if (typeof anyE.details === 'string' && anyE.details.trim()) parts.push(anyE.details.trim())
    if (typeof anyE.hint === 'string' && anyE.hint.trim()) parts.push(anyE.hint.trim())
    if (typeof anyE.code === 'string' && anyE.code.trim()) parts.push(`code=${anyE.code.trim()}`)
    if (parts.length) return parts.join(' · ')
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return e instanceof Error ? e.message : String(e)
}

/** Postgres 42P17: RLS policies on `accounts` reference each other in a cycle — fix in Supabase SQL, not in this app. */
function isAccountsRlsRecursion(msg: string): boolean {
  return /42P17/i.test(msg) || /infinite recursion/i.test(msg)
}

function formatAccountsLoadError(e: unknown): string {
  const raw = stringifyErr(e)
  if (!isAccountsRlsRecursion(raw)) return raw
  return [
    raw,
    '',
    'This is a Supabase Row Level Security configuration issue: policies on the `accounts` table trigger each other in a loop.',
    'Fix: open SQL Editor → review policies on `accounts` and remove the cycle (often a policy USING clause that queries `accounts` again).',
    'Alternative: expose read-only fields via a SECURITY DEFINER RPC (e.g. `get_my_account()`) and call that from the app instead of selecting `accounts` directly.',
  ].join('\n')
}

type AccountTool = {
  label: string
  detail: string
  href?: string
  icon: LucideIcon
  comingSoon?: boolean
}

const accountToolGroups: Array<{ title: string; tools: AccountTool[] }> = [
  {
    title: 'Workspaces',
    tools: [
      { label: 'CleanSeek-X', detail: 'Run live model/search work.', href: '/cleanseek-x', icon: Search },
      { label: 'Search history', detail: 'Replay saved X workbench sessions.', href: '/cleanseek-x/history', icon: History },
      { label: 'XMarks', detail: 'Saved X reading workflows.', href: '/xmarks', icon: BookOpen },
      { label: 'Tickers', detail: 'Market watchlists and ticker pulse.', href: '/ticker', icon: Clock },
    ],
  },
  {
    title: 'Account data',
    tools: [
      { label: 'Research library', detail: 'Shared account model from main SeekBox.', icon: Library, comingSoon: true },
      { label: 'Export my data', detail: 'Prepare account/search export flow.', icon: Database, comingSoon: true },
      { label: 'Delete account', detail: 'Danger-zone flow from main SeekBox.', icon: Trash2, comingSoon: true },
      { label: 'Help & feedback', detail: 'Read support notes and report account/search issues.', href: '/faq', icon: HelpCircle },
    ],
  },
  {
    title: 'Admin and controls',
    tools: [
      { label: 'Engine policy', detail: 'Team permissions and model access.', icon: Zap, comingSoon: true },
      { label: 'Custom modes', detail: 'Custom analysis modes and templates.', href: '/roadmap', icon: Wand },
      { label: 'Security', detail: 'SSO, OAuth, and session controls.', icon: Shield, comingSoon: true },
      { label: 'Appearance', detail: 'Theme, text size, and local preferences.', href: '#appearance', icon: Settings },
    ],
  },
]

function AccountToolCard({ tool }: { tool: AccountTool }) {
  const Icon = tool.icon
  const inner = (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-300 bg-[#f7f8f4] text-neutral-950">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm font-black text-neutral-950">{tool.label}</strong>
        <small className="mt-1 block text-xs font-semibold leading-5 text-neutral-500">{tool.detail}</small>
      </span>
      {tool.comingSoon ? (
        <em className="ml-auto shrink-0 border border-neutral-300 px-2 py-1 text-[10px] font-black not-italic uppercase tracking-wide text-neutral-500">
          Soon
        </em>
      ) : null}
    </>
  )

  const className =
    'flex min-h-[5.1rem] items-center gap-3 border border-neutral-300 bg-white p-3 text-left shadow-[3px_3px_0_rgba(0,0,0,0.04)] transition hover:border-neutral-950'

  if (!tool.href || tool.comingSoon) {
    return (
      <div className={`${className} ${tool.comingSoon ? 'opacity-75' : ''}`} aria-disabled={tool.comingSoon ? true : undefined}>
        {inner}
      </div>
    )
  }

  return (
    <a href={tool.href} className={className}>
      {inner}
    </a>
  )
}

function AccountPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'confirming' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [account, setAccount] = useState<AccountRow | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [isSyncingAccount, setIsSyncingAccount] = useState(false)

  const [siteTheme, setSiteTheme] = useState<SiteThemeMode>(() => readSiteTheme())
  const [siteFont, setSiteFont] = useState<SiteFontScale>(() => readSiteFontScale())
  const [personalizationSeed, setPersonalizationSeed] = useState<PersonalizationSeed>(() => loadPersonalizationSeed())

  const fromStripe = useMemo(() => {
    if (typeof window === 'undefined') return false
    const sp = new URLSearchParams(window.location.search)
    return sp.has('session_id') || sp.get('upgraded') === '1'
  }, [])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setStatus('error')
      setError('Supabase is not configured on this site yet.')
      return
    }

    let cancelled = false
    const loadOnce = async () => {
      setStatus(fromStripe ? 'confirming' : 'loading')
      setError(null)
      setAccountLoadError(null)
      try {
        const { data } = await sb.auth.getSession()
        const session = data.session
        const u = session?.user ?? null
        const uid = u?.id ?? null
        const em = u?.email ?? null

        if (!uid) {
          if (!cancelled) {
            setStatus('error')
            setError('Not signed in.')
          }
          return
        }

        if (!cancelled) {
          setUserId(uid)
          setEmail(em)
        }

        // Magic-link redirects land here before any other app surface has a chance
        // to create/update the account row. Ensure the signed-in user receives the
        // default trial role before reading account state.
        try {
          await ensureAccount(u as any)
        } catch (e) {
          if (!cancelled) setAccountLoadError(`Account sync failed: ${stringifyErr(e)}`)
        }

        // Pull latest subscription row (active/trialing preferred)
        const subRes = await sb
          .from('user_subscriptions')
          .select('plan,status,created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (subRes.error) throw subRes.error
        if (!cancelled) setSubscription((subRes.data as any) ?? null)

        // Pull account role info.
        // DB schemas vary: some use `owner_user_id`, others use `user_id`, or even `id = auth.uid()`.
        try {
          const selectCandidates = [
            // "full" set (some DBs)
            'id,role,granted_role,role_id,trial_ends_at,stripe_customer_id,stripe_subscription_id',
            // no role_id
            'id,role,granted_role,trial_ends_at,stripe_customer_id,stripe_subscription_id',
            // no stripe_subscription_id
            'id,role,granted_role,role_id,trial_ends_at,stripe_customer_id',
            'id,role,granted_role,trial_ends_at,stripe_customer_id',
            // minimal role/trial
            'id,role,granted_role,role_id,trial_ends_at',
            'id,role,granted_role,trial_ends_at',
            // absolute minimal
            'id,role,granted_role,role_id',
            'id,role,granted_role',
            'id,role_id',
            'id,role',
            'id',
          ] as const

          const tryBy = async (col: 'owner_user_id' | 'user_id' | 'id') => {
            let lastErr: unknown = null
            for (const cols of selectCandidates) {
              const res = await sb.from('accounts').select(cols).eq(col, uid).maybeSingle()
              if (!res.error) return res
              lastErr = res.error
              const msg = stringifyErr(res.error)
              if (isAccountsRlsRecursion(msg)) return res
              // If a selected column doesn't exist, try a reduced column set.
              if (/does not exist/i.test(msg) || /column/i.test(msg) || /42703/.test(msg) || /PGRST/i.test(msg)) {
                continue
              }
              // Otherwise, stop (likely RLS / permission / table missing).
              return res
            }
            return { data: null, error: lastErr } as any
          }

          const first = await tryBy('owner_user_id')
          if (!first.error) {
            if (!cancelled) setAccount((first.data as any) ?? null)
          } else {
            const msg = stringifyErr(first.error)
            // If the column doesn't exist (or schema differs), try fallbacks.
            const shouldFallback =
              /owner_user_id/i.test(msg) ||
              /column/i.test(msg) ||
              /does not exist/i.test(msg) ||
              /schema/i.test(msg) ||
              /PGRST/i.test(msg)

            if (!shouldFallback) throw first.error

            const second = await tryBy('user_id')
            if (!second.error) {
              if (!cancelled) setAccount((second.data as any) ?? null)
            } else {
              const third = await tryBy('id')
              if (third.error) throw third.error
              if (!cancelled) setAccount((third.data as any) ?? null)
            }
          }
        } catch (e) {
          // Non-fatal: subscription can still be shown even if accounts table
          // is missing or blocked by RLS.
          if (!cancelled) {
            setAccount(null)
            setAccountLoadError(formatAccountsLoadError(e))
          }
        }

        if (!cancelled) setStatus('idle')
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Failed to load account.')
        }
      }
    }

    loadOnce()

    // Post-Stripe: poll for up to ~30s so webhook has time to land.
    if (fromStripe) {
      let attempts = 0
      const iv = setInterval(() => {
        attempts += 1
        setRefreshTick((t) => t + 1)
        if (attempts >= 10) clearInterval(iv)
      }, 3000)

      // Strip params so refresh doesn't loop forever.
      try {
        window.history.replaceState({}, '', window.location.pathname)
      } catch {
        /* ignore */
      }

      return () => {
        cancelled = true
        clearInterval(iv)
      }
    }

    return () => {
      cancelled = true
    }
  }, [fromStripe, refreshTick])

  useEffect(() => {
    setSiteTheme(readSiteTheme())
    setSiteFont(readSiteFontScale())
  }, [])

  const setThemeAndPersist = (t: SiteThemeMode) => {
    setSiteTheme(t)
    writeSiteTheme(t)
    applySiteThemeToDocument(t)
  }

  const setFontAndPersist = (f: SiteFontScale) => {
    setSiteFont(f)
    writeSiteFontScale(f)
    applySiteFontToDocument(f)
  }

  const isPaid =
    (subscription?.status === 'active' || subscription?.status === 'trialing') && Boolean(subscription?.plan)
  const displayedRole = (() => {
    const role = account?.granted_role ?? account?.role ?? account?.role_id ?? null
    return normalizeRoleForDisplay(role, email)
  })()
  const personalizationLevel = personalizationLevelForRole(displayedRole ?? (email ? 'trial' : 'anon'))
  const personalizationDefaultLens = defaultLensForLevel(personalizationLevel)
  const personalizationLabel = personalizationLevelLabel(personalizationLevel)

  const updatePersonalizationSeed = (patch: Partial<PersonalizationSeed>) => {
    setPersonalizationSeed((current) => {
      const next = { ...current, ...patch }
      savePersonalizationSeed(next)
      return next
    })
  }

  const syncAccountRow = async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!email || !userId || !sb) return
    setIsSyncingAccount(true)
    try {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user ?? null
      if (!u) throw new Error('Not signed in.')
      await ensureAccount(u as any)
      setRefreshTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync account row.')
      setStatus('error')
    } finally {
      setIsSyncingAccount(false)
    }
  }

  const signOut = async () => {
    try {
      await supabase?.auth.signOut({ scope: 'local' })
    } catch {
      // Local redirect still clears the working session on next app boot.
    }
    if (typeof window !== 'undefined') window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="none" title="X.SeekBoxAI Account" eyebrow="profile, plan, billing, and saved work" logoSize="lg" />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Signed-in account</div>
            <h1 className="mt-3 text-3xl font-black leading-[1.02] tracking-tight sm:text-5xl">
              Profile, plan, and search memory in one place.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-neutral-600 sm:text-base">
              Same account model as the main SeekBox app, with X.SeekBoxAI workspaces and history surfaced first.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="/plans" className="inline-flex items-center gap-2 bg-neutral-950 px-4 py-2 text-sm font-black text-white">
                <CreditCard className="h-4 w-4" />
                {isPaid ? 'Manage / upgrade' : 'View plans'}
              </a>
              <button
                onClick={() => setRefreshTick((t) => t + 1)}
                className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-900 hover:border-neutral-950"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-900 hover:border-neutral-950"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          <div className="grid gap-3 border border-neutral-300 bg-[#fbfbf7] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-neutral-300 bg-white">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-black">{email ? email : 'Not signed in'}</div>
                <div className="mt-1 text-xs font-semibold text-neutral-500">
                  {userId ? <span className="font-mono">{userId.slice(0, 8)}…</span> : 'No Supabase session'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="border border-neutral-300 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Plan</div>
                <div className="mt-1 text-lg font-black">{subscription?.plan ?? '—'}</div>
                <div className="text-xs font-semibold text-neutral-500">{subscription?.status ?? 'No active row'}</div>
              </div>
              <div className="border border-neutral-300 bg-white p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Role</div>
                <div className="mt-1 text-lg font-black">{displayedRole ?? '—'}</div>
                <div className="text-xs font-semibold text-neutral-500">
                  Trial {account?.trial_ends_at ? new Date(account.trial_ends_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {status === 'confirming' ? (
          <div className="border border-emerald-600/25 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            Confirming your subscription… (waiting for Stripe webhook)
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="border border-red-600/25 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error ?? 'Something went wrong.'}
          </div>
        ) : null}

        {accountLoadError ? (
          <div className="border border-amber-600/25 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900 whitespace-pre-wrap">
            Couldn’t load <span className="font-mono">accounts</span>: {accountLoadError}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {accountToolGroups.map((group) => (
            <div key={group.title} className="border border-neutral-300 bg-[#fbfbf7] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">{group.title}</div>
              <div className="mt-4 grid gap-2">
                {group.tools.map((tool) => (
                  <AccountToolCard key={tool.label} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section id="appearance" className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Appearance</div>
              <p className="mt-1 text-sm font-semibold leading-6 text-neutral-600">
                Theme and text size match the floating toolbar. Stored on this device only (
                <span className="font-mono text-neutral-500">sb_theme_mode_v2</span>,{' '}
                <span className="font-mono text-neutral-500">sb_font_scale_v1</span>).
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Theme</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SITE_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setThemeAndPersist(opt.id)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                    siteTheme === opt.id
                      ? 'border-neutral-950 bg-neutral-950 text-white'
                      : 'border-neutral-300 bg-[#fbfbf7] text-neutral-900 hover:border-neutral-950'
                  }`}
                  aria-pressed={siteTheme === opt.id}
                >
                  <div className="text-sm font-black">{opt.label}</div>
                  <div className={`mt-1 text-xs ${siteTheme === opt.id ? 'text-neutral-200' : 'text-neutral-500'}`}>{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Text size</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFontAndPersist((siteFont > 0 ? siteFont - 1 : 0) as SiteFontScale)}
                disabled={siteFont === 0}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-900 disabled:opacity-40"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontAndPersist(0)}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-900"
              >
                Default ({siteFontPx(0)}px)
              </button>
              <button
                type="button"
                onClick={() => setFontAndPersist((siteFont < 2 ? siteFont + 1 : 2) as SiteFontScale)}
                disabled={siteFont === 2}
                className="border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-900 disabled:opacity-40"
              >
                A+
              </button>
              <span className="text-xs font-semibold text-neutral-500">
                Current root size: <span className="font-mono text-neutral-700">{siteFontPx(siteFont)}px</span>
              </span>
            </div>
          </div>
        </section>

        <section className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Personalization seed</div>
              <h2 className="mt-1 text-xl font-black">{personalizationLabel}</h2>
              <p className="mt-1 max-w-xl text-sm font-semibold leading-6 text-neutral-600">
                This is the lightweight contract that search and history can use now. Full personas can replace or extend it later.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-xs font-black uppercase tracking-wide text-neutral-800">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-950"
                checked={personalizationSeed.enabled}
                onChange={(event) => updatePersonalizationSeed({ enabled: event.target.checked })}
              />
              Enabled
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Profile note</span>
              <textarea
                value={personalizationSeed.profileNote}
                onChange={(event) => updatePersonalizationSeed({ profileNote: event.target.value })}
                rows={4}
                placeholder="Example: I am building X.SeekBoxAI, care about live data, product architecture, GTM, and customer-ready summaries."
                className="mt-2 w-full resize-y border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-sm font-semibold text-neutral-950 placeholder:text-neutral-400 outline-none focus:border-neutral-950"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wide text-neutral-500">Default lens</span>
              <textarea
                value={personalizationSeed.preferredLens}
                onChange={(event) => updatePersonalizationSeed({ preferredLens: event.target.value })}
                rows={4}
                placeholder={personalizationDefaultLens}
                className="mt-2 w-full resize-y border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-sm font-semibold text-neutral-950 placeholder:text-neutral-400 outline-none focus:border-neutral-950"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-neutral-300 bg-[#fbfbf7] px-4 py-3">
            <div>
              <div className="text-sm font-black text-neutral-950">History classing</div>
              <p className="mt-1 text-xs font-semibold leading-5 text-neutral-500">
                Searches get a broad class such as market watch, industry pulse, technical research, or customer support.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wide text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-neutral-950"
                checked={personalizationSeed.historyClassing}
                onChange={(event) => updatePersonalizationSeed({ historyClassing: event.target.checked })}
              />
              Classify
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-3 border border-neutral-300 bg-[#fbfbf7] p-4 text-sm font-semibold text-neutral-600 shadow-[4px_4px_0_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            If you just completed checkout, this page will usually update within a few seconds once the Stripe webhook writes to{' '}
            <span className="font-mono">user_subscriptions</span> and updates <span className="font-mono">accounts.role_id</span>.
          </span>
          <button
            onClick={syncAccountRow}
            disabled={!email || !userId || isSyncingAccount}
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-xs font-black text-neutral-900 hover:border-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {isSyncingAccount ? 'Syncing…' : 'Create/Sync account row'}
          </button>
        </section>
      </main>
    </div>
  )
}

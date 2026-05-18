export const SESSION_SEARCH_COUNT_KEY = 'sb_session_searches'
export const ANON_SESSION_SEARCH_CAP = 10
export const TRIAL_MONTHLY_SEARCH_CAP = 250

type SupabaseLike = {
  from: (table: string) => any
}

export type AccountProfileUser = {
  id?: string | null
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

type RoleSummary = {
  id: string
  label: string
  description: string
  level: number | null
  emoji: string | null
  searchInputMax: number | null
  responseLengthMax: number | null
}

type AccountRow = {
  role?: string | null
  granted_role?: string | null
  role_id?: string | null
  trial_ends_at?: string | null
}

type SubscriptionRow = {
  plan?: string | null
  status?: string | null
  trial_end?: string | null
}

export type AccountProfileSummary = {
  loading: boolean
  fetched: boolean
  signedIn: boolean
  email: string | null
  displayName: string | null
  avatarInitial: string | null
  roleId: string
  roleLevel: number | null
  roleLabel: string
  roleDescription: string
  roleEmoji: string | null
  accountRole: string | null
  grantedRole: string | null
  subscriptionPlan: string | null
  subscriptionPlanLabel: string | null
  subscriptionStatus: string | null
  subscriptionStatusLabel: string | null
  subscriptionSummary: string | null
  subscriptionTrialEndsAt: string | null
  accountTrialEndsAt: string | null
  trialDaysLeft: number | null
  monthlySearches: number | null
  searchesLimit: number | null
  searchesLeft: number | null
  searchInputMax: number | null
  responseLengthMax: number | null
  searchWindowLabel: 'this session' | 'this month' | null
  hasSubscription: boolean
  tooltipLines: string[]
}

const FALLBACK_ROLE_SUMMARIES: Record<string, RoleSummary> = {
  superadmin: {
    id: 'superadmin',
    label: 'Super Admin',
    description: 'Unrestricted access to all features and settings',
    level: 10,
    emoji: null,
    searchInputMax: null,
    responseLengthMax: null,
  },
  god: {
    id: 'god',
    label: 'God',
    description: 'Operator bypass role with full access',
    level: 10,
    emoji: null,
    searchInputMax: null,
    responseLengthMax: null,
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    description: 'Full features with minor guardrails',
    level: 10,
    emoji: null,
    searchInputMax: null,
    responseLengthMax: null,
  },
  advisor: {
    id: 'advisor',
    label: 'Advisor',
    description: 'Trusted collaborator access with Power features',
    level: 8,
    emoji: null,
    searchInputMax: 1000,
    responseLengthMax: null,
  },
  power: {
    id: 'power',
    label: 'Power',
    description: 'Advanced features with full model and analysis access',
    level: 4,
    emoji: null,
    searchInputMax: 1000,
    responseLengthMax: 1500,
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    description: '$5/mo plan with starter search access',
    level: 3,
    emoji: null,
    searchInputMax: 250,
    responseLengthMax: 500,
  },
  restricted: {
    id: 'restricted',
    label: 'Restricted',
    description: 'Minimal demo-level access',
    level: 1,
    emoji: null,
    searchInputMax: 100,
    responseLengthMax: 250,
  },
  anon: {
    id: 'anon',
    label: 'Anon',
    description: 'Pre-signup access before an account is created',
    level: 1,
    emoji: null,
    searchInputMax: 100,
    responseLengthMax: 250,
  },
  trial: {
    id: 'trial',
    label: 'Trial',
    description: 'Signed-up evaluation tier assigned during account setup',
    level: 2,
    emoji: null,
    searchInputMax: 250,
    responseLengthMax: 500,
  },
  free: {
    id: 'free',
    label: 'Free',
    description: 'Free-tier signed-in account',
    level: 2,
    emoji: null,
    searchInputMax: 100,
    responseLengthMax: 250,
  },
  family: {
    id: 'family',
    label: 'Family',
    description: 'Family plan access',
    level: 4,
    emoji: null,
    searchInputMax: 1000,
    responseLengthMax: 1500,
  },
  business: {
    id: 'business',
    label: 'Business',
    description: 'Business plan access',
    level: 4,
    emoji: null,
    searchInputMax: 1000,
    responseLengthMax: null,
  },
}

const PLAN_TO_ROLE: Record<string, string> = {
  trial: 'trial',
  free: 'free',
  starter: 'starter',
  power: 'power',
  pro: 'power',
  family: 'family',
  business: 'business',
  enterprise: 'business',
  grokx: 'power',
  grok_x: 'power',
}

function parseCount(raw: string | null): number {
  const n = Number.parseInt(raw ?? '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parsePositiveLimit(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

function parseRoleLevel(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

export function readSessionSearchCount(key = SESSION_SEARCH_COUNT_KEY): number {
  if (typeof window === 'undefined') return 0
  try {
    return parseCount(window.sessionStorage.getItem(key))
  } catch {
    return 0
  }
}

export function incrementSessionSearchCount(key = SESSION_SEARCH_COUNT_KEY): number {
  const next = readSessionSearchCount(key) + 1
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(key, String(next))
    } catch {
      /* noop */
    }
  }
  return next
}

export function humanizeRoleId(id: string): string {
  return id
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function normalizeId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const id = raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return id || null
}

function normalizeRoleId(raw: unknown, email: string | null): string | null {
  const id = normalizeId(raw)
  if (!id) return null
  if (id === 'guest') return email ? 'trial' : 'anon'
  if (id === 'power_user') return 'power'
  if (id === 'standard') return 'free'
  if (email && id === 'anon') return 'trial'
  return id
}

function roleForPlan(plan: string | null): string | null {
  if (!plan) return null
  if (plan === 'power_user') return 'power'
  if (plan === 'standard') return 'free'
  return PLAN_TO_ROLE[plan] ?? null
}

function fallbackRoleSummary(roleId: string): RoleSummary {
  return (
    FALLBACK_ROLE_SUMMARIES[roleId] ?? {
      id: roleId,
      label: humanizeRoleId(roleId),
      description: `${humanizeRoleId(roleId)} access`,
      level: null,
      emoji: null,
      searchInputMax: null,
      responseLengthMax: null,
    }
  )
}

function getDisplayName(user: AccountProfileUser | null | undefined): string | null {
  const meta = user?.user_metadata ?? null
  const fromMeta = meta?.full_name ?? meta?.name ?? meta?.display_name
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  return user?.email ?? null
}

function getAvatarInitial(user: AccountProfileUser | null | undefined, roleId: string): string | null {
  const name = getDisplayName(user)
  const seed = name || user?.email || roleId
  return seed ? seed.charAt(0).toUpperCase() : null
}

function formatPlanWord(plan: string | null): string | null {
  if (!plan) return null
  const displayPlan = plan === 'power_user' ? 'power' : plan === 'standard' ? 'free' : plan
  const spaced = displayPlan.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

function formatSubscriptionStatus(status: string | null): string | null {
  if (!status) return null
  const id = status.toLowerCase()
  if (id === 'trialing') return 'Trial'
  if (id === 'active') return 'Active'
  if (id === 'past_due') return 'Past due'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms <= Date.now()) return null
  return Math.max(1, Math.ceil((ms - Date.now()) / 86400000))
}

function buildTooltipLines(summary: Omit<AccountProfileSummary, 'tooltipLines'>): string[] {
  const levelText = summary.roleLevel !== null ? ` · level ${summary.roleLevel}` : ''
  const lines = [`${summary.roleLabel}${levelText}: ${summary.roleDescription}`]
  if (summary.searchesLeft !== null && summary.searchesLimit !== null && summary.searchWindowLabel) {
    lines.push(
      `${summary.searchesLeft} search${summary.searchesLeft === 1 ? '' : 'es'} left ${summary.searchWindowLabel} (${summary.searchesLimit} max)`,
    )
  }
  if (summary.subscriptionSummary) {
    lines.push(`Plan: ${summary.subscriptionSummary}`)
  } else if (summary.signedIn) {
    lines.push('Plan: no subscription on file')
  } else {
    lines.push('Plan: sign in to start trial access')
  }
  if (summary.trialDaysLeft !== null) {
    lines.push(`${summary.trialDaysLeft} day${summary.trialDaysLeft === 1 ? '' : 's'} left in trial`)
  }
  return lines
}

function finalizeSummary(summary: Omit<AccountProfileSummary, 'tooltipLines'>): AccountProfileSummary {
  return { ...summary, tooltipLines: buildTooltipLines(summary) }
}

export function getLocalAccountProfileSummary(args: {
  user?: AccountProfileUser | null
  activeRole?: string | null
  sessionSearchCount?: number | null
  anonSearchCap?: number
  trialSearchCap?: number
} = {}): AccountProfileSummary {
  const user = args.user ?? null
  const email = user?.email ?? null
  const signedIn = Boolean(user?.id || email)
  const roleId =
    normalizeRoleId(args.activeRole, email) ?? (signedIn ? 'trial' : 'anon')
  const safeRoleId = signedIn && roleId === 'anon' ? 'trial' : roleId
  const role = fallbackRoleSummary(safeRoleId)
  const anonLimit = args.anonSearchCap ?? ANON_SESSION_SEARCH_CAP
  const trialLimit = args.trialSearchCap ?? TRIAL_MONTHLY_SEARCH_CAP
  const sessionUsed = args.sessionSearchCount ?? readSessionSearchCount()
  const searchesLimit = safeRoleId === 'anon' ? anonLimit : safeRoleId === 'trial' ? trialLimit : null
  const searchesLeft =
    safeRoleId === 'anon' && searchesLimit !== null
      ? Math.max(0, searchesLimit - sessionUsed)
      : null

  return finalizeSummary({
    loading: false,
    fetched: false,
    signedIn,
    email,
    displayName: getDisplayName(user),
    avatarInitial: getAvatarInitial(user, safeRoleId),
    roleId: safeRoleId,
    roleLevel: role.level,
    roleLabel: role.label,
    roleDescription: role.description,
    roleEmoji: role.emoji,
    accountRole: null,
    grantedRole: null,
    subscriptionPlan: null,
    subscriptionPlanLabel: null,
    subscriptionStatus: null,
    subscriptionStatusLabel: null,
    subscriptionSummary: null,
    subscriptionTrialEndsAt: null,
    accountTrialEndsAt: null,
    trialDaysLeft: null,
    monthlySearches: null,
    searchesLimit,
    searchesLeft,
    searchInputMax: role.searchInputMax,
    responseLengthMax: role.responseLengthMax,
    searchWindowLabel: safeRoleId === 'anon' ? 'this session' : safeRoleId === 'trial' ? 'this month' : null,
    hasSubscription: false,
  })
}

async function fetchAccountRow(supabase: SupabaseLike, uid: string): Promise<AccountRow | null> {
  const selects = [
    'role,granted_role,role_id,trial_ends_at',
    'role,granted_role,trial_ends_at',
    'role,granted_role,role_id',
    'role,granted_role',
  ]
  for (const col of ['owner_user_id', 'user_id', 'id']) {
    for (const select of selects) {
      try {
        const res = await supabase.from('accounts').select(select).eq(col, uid).maybeSingle()
        if (!res.error && res.data) return res.data as AccountRow
        if (!res.error) continue
        const msg = String(res.error.message ?? '')
        if (/42703|column|PGRST/i.test(msg)) continue
      } catch {
        continue
      }
    }
  }
  return null
}

async function fetchSubscriptionRow(supabase: SupabaseLike, uid: string): Promise<SubscriptionRow | null> {
  try {
    const res = await supabase
      .from('user_subscriptions')
      .select('plan,status,trial_end,created_at')
      .eq('user_id', uid)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!res.error && res.data) return res.data as SubscriptionRow
  } catch {
    /* noop */
  }
  return null
}

async function fetchMonthlySearches(supabase: SupabaseLike, uid: string): Promise<number | null> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  try {
    const res = await supabase
      .from('search_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('created_at', monthStart.toISOString())
    return typeof res.count === 'number' ? res.count : null
  } catch {
    return null
  }
}

async function fetchRoleSummary(supabase: SupabaseLike, roleId: string): Promise<RoleSummary> {
  const selects = [
    'role_id,label,level,description,emoji,searchinputmax,responselengthmax',
    'role_id,label,description,emoji,searchinputmax,responselengthmax',
  ]
  for (const select of selects) {
    try {
      const res = await supabase
        .from('role_definitions')
        .select(select)
        .eq('role_id', roleId)
        .maybeSingle()
      if (res.error) {
        const msg = String(res.error.message ?? '')
        if (/42703|column|PGRST/i.test(msg)) continue
        return fallbackRoleSummary(roleId)
      }
      if (res.data) {
        const row = res.data as Record<string, unknown>
        const fallback = fallbackRoleSummary(roleId)
        return {
          id: roleId,
          label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : fallback.label,
          description:
            typeof row.description === 'string' && row.description.trim()
              ? row.description.trim()
              : fallback.description,
          level: parseRoleLevel(row.level) ?? fallback.level,
          emoji: typeof row.emoji === 'string' && row.emoji.trim() ? row.emoji.trim() : null,
          searchInputMax: parsePositiveLimit(row.searchinputmax) ?? fallback.searchInputMax,
          responseLengthMax: parsePositiveLimit(row.responselengthmax) ?? fallback.responseLengthMax,
        }
      }
    } catch {
      /* noop */
    }
  }
  return fallbackRoleSummary(roleId)
}

async function fetchMonthlyQuota(supabase: SupabaseLike, roleId: string, plan: string | null): Promise<number | null> {
  const candidates = Array.from(new Set([plan, roleId, roleId === 'trial' ? 'starter' : null].filter(Boolean))) as string[]
  if (!candidates.length) return null
  try {
    const res = await supabase
      .from('plan_quota_defaults')
      .select('plan,metric,monthly_limit')
      .in('plan', candidates)
      .in('metric', ['sessions', 'searches', 'search_sessions'])
    if (res.error || !Array.isArray(res.data)) return null
    for (const planId of candidates) {
      const row = (res.data as Array<Record<string, unknown>>).find((r) => r.plan === planId)
      const n = typeof row?.monthly_limit === 'number' ? row.monthly_limit : Number(row?.monthly_limit)
      if (Number.isFinite(n) && n >= 0) return n
    }
  } catch {
    /* noop */
  }
  return null
}

export async function getAccountProfileSummary(args: {
  supabase?: SupabaseLike | null
  user?: AccountProfileUser | null
  activeRole?: string | null
  sessionSearchCount?: number | null
  anonSearchCap?: number
  trialSearchCap?: number
} = {}): Promise<AccountProfileSummary> {
  const user = args.user ?? null
  const uid = user?.id ?? null
  const email = user?.email ?? null
  const local = getLocalAccountProfileSummary(args)

  if (!args.supabase || !uid) {
    return { ...local, fetched: true, loading: false }
  }

  const [account, subscription, monthlySearches] = await Promise.all([
    fetchAccountRow(args.supabase, uid),
    fetchSubscriptionRow(args.supabase, uid),
    fetchMonthlySearches(args.supabase, uid),
  ])

  const subscriptionPlan = normalizeId(subscription?.plan)
  const subscriptionStatus = normalizeId(subscription?.status)
  const accountRole = normalizeRoleId(account?.role_id ?? account?.role, email)
  const grantedRole = normalizeRoleId(account?.granted_role, email)
  const planRole = subscriptionStatus ? roleForPlan(subscriptionPlan) : null
  const requestedRole = normalizeRoleId(args.activeRole, email)
  let roleId = grantedRole ?? planRole ?? accountRole ?? requestedRole ?? 'trial'
  if (email && roleId === 'anon') roleId = 'trial'

  const role = await fetchRoleSummary(args.supabase, roleId)
  const quota = await fetchMonthlyQuota(args.supabase, roleId, subscriptionPlan)
  const trialLimit = quota ?? args.trialSearchCap ?? TRIAL_MONTHLY_SEARCH_CAP
  const showSearchesLeft = roleId === 'anon' || roleId === 'trial'
  const searchesLimit =
    roleId === 'anon'
      ? args.anonSearchCap ?? ANON_SESSION_SEARCH_CAP
      : roleId === 'trial'
        ? trialLimit
        : null
  const used = roleId === 'anon' ? readSessionSearchCount() : monthlySearches
  const searchesLeft =
    showSearchesLeft && searchesLimit !== null && typeof used === 'number'
      ? Math.max(0, searchesLimit - used)
      : null
  const planLabel = formatPlanWord(subscriptionPlan)
  const statusLabel = formatSubscriptionStatus(subscriptionStatus)
  const subscriptionSummary = [planLabel, statusLabel].filter(Boolean).join(' - ') || null
  const trialIso = subscription?.trial_end ?? account?.trial_ends_at ?? null

  return finalizeSummary({
    loading: false,
    fetched: true,
    signedIn: true,
    email,
    displayName: getDisplayName(user),
    avatarInitial: getAvatarInitial(user, roleId),
    roleId,
    roleLevel: role.level,
    roleLabel: role.label,
    roleDescription: role.description,
    roleEmoji: role.emoji,
    accountRole,
    grantedRole,
    subscriptionPlan,
    subscriptionPlanLabel: planLabel,
    subscriptionStatus,
    subscriptionStatusLabel: statusLabel,
    subscriptionSummary,
    subscriptionTrialEndsAt: subscription?.trial_end ?? null,
    accountTrialEndsAt: account?.trial_ends_at ?? null,
    trialDaysLeft: daysLeft(trialIso),
    monthlySearches,
    searchesLimit,
    searchesLeft,
    searchInputMax: role.searchInputMax,
    responseLengthMax: role.responseLengthMax,
    searchWindowLabel: roleId === 'anon' ? 'this session' : roleId === 'trial' ? 'this month' : null,
    hasSubscription: Boolean(subscriptionPlan || subscriptionStatus),
  })
}

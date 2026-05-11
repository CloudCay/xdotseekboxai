const SEEKBOX_ORIGIN = 'https://x.seekboxai.com'
const STORAGE_KEYS = {
  token: 'seekboxSecondOpinions.accessToken',
  tokenExpiresAt: 'seekboxSecondOpinions.tokenExpiresAt',
  clientId: 'seekboxSecondOpinions.clientId',
}

const els = {
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  authStatus: document.getElementById('authStatus'),
  syncSignIn: document.getElementById('syncSignIn'),
  openAccount: document.getElementById('openAccount'),
  question: document.getElementById('question'),
  quickOpinion: document.getElementById('quickOpinion'),
  compareOpinion: document.getElementById('compareOpinion'),
  openSeekBox: document.getElementById('openSeekBox'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
}

let activeTab = null
let lastContext = null

init()

async function init() {
  activeTab = await getActiveTab()
  renderActiveTab(activeTab)
  await refreshAuthStatus()

  els.quickOpinion.addEventListener('click', () => runOpinion('quick'))
  els.compareOpinion.addEventListener('click', () => runOpinion('compare'))
  els.openSeekBox.addEventListener('click', openInSeekBox)
  els.openAccount.addEventListener('click', () => chrome.tabs.create({ url: `${SEEKBOX_ORIGIN}/account` }))
  els.syncSignIn.addEventListener('click', syncSignInFromActiveTab)
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] ?? null
}

function renderActiveTab(tab) {
  els.pageTitle.textContent = tab?.title || 'No active page'
  els.pageUrl.textContent = tab?.url || ''
}

async function runOpinion(mode) {
  setBusy(true)
  setStatus(mode === 'compare' ? 'Asking several reads...' : 'Getting a second opinion...')
  renderResults([])

  try {
    const context = await collectActivePageContext()
    lastContext = context
    const auth = await getStoredAuth()
    const clientId = await getClientId()

    const response = await fetch(`${SEEKBOX_ORIGIN}/api/second-opinion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-seekbox-extension': 'second-opinions/0.1.0',
        ...(auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : {}),
      },
      body: JSON.stringify({
        mode,
        url: context.url,
        canonicalUrl: context.canonicalUrl,
        title: context.title,
        selectedText: context.selectedText,
        pageText: context.pageText,
        question: els.question.value.trim(),
        clientId,
        save: Boolean(auth.accessToken),
      }),
    })

    const json = await response.json()
    if (!response.ok) throw new Error(json.error || `SeekBox returned HTTP ${response.status}`)

    const opinions = Array.isArray(json.opinions) ? json.opinions : []
    renderResults(opinions, json)
    setStatus(json.saved ? 'Saved to your SeekBox bookmarks.' : json.signedIn ? 'Read complete.' : 'Read complete. Sync sign-in to save these as bookmarks.')
  } catch (error) {
    setStatus(error?.message || 'Could not get a second opinion.', true)
  } finally {
    setBusy(false)
  }
}

async function collectActivePageContext() {
  if (!activeTab?.id || !/^https?:\/\//i.test(activeTab.url || '')) {
    throw new Error('Open a normal web page first.')
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: () => {
      const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
      const selection = clean(window.getSelection?.().toString() || '', 8000)
      const canonical = document.querySelector('link[rel="canonical"]')?.href || null
      const description =
        document.querySelector('meta[name="description"]')?.content ||
        document.querySelector('meta[property="og:description"]')?.content ||
        ''
      const articleText = document.querySelector('article')?.innerText || ''
      const bodyText = document.body?.innerText || ''
      const pageText = clean([description, articleText || bodyText].filter(Boolean).join('\n\n'), 16000)
      return {
        url: location.href,
        canonicalUrl: canonical,
        title: document.title,
        selectedText: selection,
        pageText,
      }
    },
  })

  const context = result?.result
  if (!context) throw new Error('Could not read this page.')
  return {
    url: context.url || activeTab.url,
    canonicalUrl: context.canonicalUrl || null,
    title: context.title || activeTab.title || '',
    selectedText: context.selectedText || '',
    pageText: context.pageText || '',
  }
}

async function syncSignInFromActiveTab() {
  try {
    const tab = await getActiveTab()
    if (!tab?.id || !isSeekBoxUrl(tab.url || '')) {
      chrome.tabs.create({ url: `${SEEKBOX_ORIGIN}/account` })
      setStatus('Sign in on SeekBox, then click Sync sign-in while that tab is active.')
      return
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const parseMaybeBase64Json = (raw) => {
          if (!raw) return null
          const text = raw.startsWith('base64-') ? atob(raw.slice(7)) : raw
          try {
            return JSON.parse(text)
          } catch {
            return null
          }
        }
        const key = Object.keys(localStorage).find((candidate) => /^sb-.+-auth-token$/.test(candidate))
        const parsed = parseMaybeBase64Json(key ? localStorage.getItem(key) : null)
        const session = parsed?.currentSession || parsed
        return {
          accessToken: session?.access_token || null,
          expiresAt: session?.expires_at || null,
          email: session?.user?.email || null,
        }
      },
    })

    const session = result?.result
    if (!session?.accessToken) {
      setStatus('No active SeekBox sign-in was found on this tab.', true)
      return
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.token]: session.accessToken,
      [STORAGE_KEYS.tokenExpiresAt]: session.expiresAt || 0,
    })
    await refreshAuthStatus(session.email)
    setStatus('SeekBox sign-in synced. Future reads can save as bookmarks.')
  } catch (error) {
    setStatus(error?.message || 'Could not sync SeekBox sign-in.', true)
  }
}

function isSeekBoxUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'x.seekboxai.com' || host === 'seekboxai.com' || host === 'seekbox.ai'
  } catch {
    return false
  }
}

async function getStoredAuth() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.token, STORAGE_KEYS.tokenExpiresAt])
  const accessToken = values[STORAGE_KEYS.token] || ''
  const expiresAt = Number(values[STORAGE_KEYS.tokenExpiresAt] || 0)
  if (!accessToken) return { accessToken: '' }
  if (expiresAt && expiresAt * 1000 < Date.now() + 30_000) {
    await chrome.storage.local.remove([STORAGE_KEYS.token, STORAGE_KEYS.tokenExpiresAt])
    return { accessToken: '' }
  }
  return { accessToken }
}

async function refreshAuthStatus(email) {
  const auth = await getStoredAuth()
  els.authStatus.textContent = auth.accessToken ? `Signed in${email ? ` as ${email}` : ''}; reads can save.` : 'Free transient read'
}

async function getClientId() {
  const values = await chrome.storage.local.get([STORAGE_KEYS.clientId])
  if (values[STORAGE_KEYS.clientId]) return values[STORAGE_KEYS.clientId]
  const id = crypto.randomUUID()
  await chrome.storage.local.set({ [STORAGE_KEYS.clientId]: id })
  return id
}

async function openInSeekBox() {
  try {
    const context = lastContext || (await collectActivePageContext())
    const query = [
      'SeekBox Second Opinion',
      context.title ? `Page: ${context.title}` : '',
      `URL: ${context.url}`,
      context.selectedText ? `Selected text: ${context.selectedText.slice(0, 1400)}` : `Page excerpt: ${context.pageText.slice(0, 1400)}`,
    ]
      .filter(Boolean)
      .join('\n\n')
    const params = new URLSearchParams({ q: query, latest: '1', preset: 'web', autorun: '1' })
    chrome.tabs.create({ url: `${SEEKBOX_ORIGIN}/cleanseek-x?${params.toString()}` })
  } catch (error) {
    setStatus(error?.message || 'Could not open SeekBox.', true)
  }
}

function renderResults(opinions, payload) {
  els.results.hidden = !opinions.length && !payload?.upstreamError
  els.results.textContent = ''

  if (payload?.upstreamError && !opinions.some((opinion) => opinion.content)) {
    const card = resultCard('SeekBox route', payload.upstreamError, 'Check backend')
    els.results.appendChild(card)
    return
  }

  for (const opinion of opinions) {
    const label = opinion.providerName || opinion.provider || 'Provider'
    const body = opinion.content || opinion.error || 'No response returned.'
    const status = opinion.status === 'success' ? 'read' : 'error'
    els.results.appendChild(resultCard(label, body, status))
  }
}

function resultCard(label, body, status) {
  const card = document.createElement('article')
  card.className = 'result-card'
  const head = document.createElement('div')
  head.className = 'result-head'
  head.innerHTML = `<span></span><span class="pill"></span>`
  head.children[0].textContent = label
  head.children[1].textContent = status
  const text = document.createElement('div')
  text.className = 'result-body'
  text.textContent = body
  card.append(head, text)
  return card
}

function setBusy(busy) {
  els.quickOpinion.disabled = busy
  els.compareOpinion.disabled = busy
  els.openSeekBox.disabled = busy
}

function setStatus(message, isError = false) {
  els.status.hidden = false
  els.status.textContent = message
  els.status.classList.toggle('error', Boolean(isError))
}

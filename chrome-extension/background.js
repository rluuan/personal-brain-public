// Personal Brain - Live Memory Background Service Worker
// Manifest V3 — captures tab metadata and sends to Personal Brain API

const STORAGE_KEY = 'personal_brain_config'
const QUEUE_KEY   = 'personal_brain_queue'

// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  apiUrl:  'http://localhost:3001',
  userId:  '',
  enabled: true,
}

async function getConfig() {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  return { ...DEFAULT_CONFIG, ...(stored[STORAGE_KEY] || {}) }
}

// ─── URL filter — skip internal/extension URLs ────────────────────────────────
function shouldCapture(url) {
  if (!url) return false
  const skip = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://', 'moz-extension://', 'file://']
  return !skip.some(prefix => url.startsWith(prefix)) && (url.startsWith('http://') || url.startsWith('https://'))
}

// ─── Send capture to API ──────────────────────────────────────────────────────
async function captureUrl(url, title, favIconUrl) {
  const config = await getConfig()
  if (!config.enabled || !config.userId) {
    // Queue for later if user not configured
    await queueCapture({ url, title, favicon: favIconUrl })
    return
  }

  try {
    const res = await fetch(`${config.apiUrl}/api/memory/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title,
        favicon: favIconUrl || null,
        timestamp: new Date().toISOString(),
        source: 'chrome-extension',
        user_id: config.userId,
      }),
    })
    if (!res.ok) {
      console.warn(`[LiveMemory] Capture failed: ${res.status}`)
      await queueCapture({ url, title, favicon: favIconUrl })
    } else {
      const data = await res.json()
      if (data.status === 'created') {
        console.log(`[LiveMemory] Captured: ${title || url}`)
        // Show badge briefly
        chrome.action.setBadgeText({ text: '✓' })
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' })
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000)
      }
    }
  } catch (err) {
    console.warn(`[LiveMemory] Network error: ${err.message}`)
    await queueCapture({ url, title, favicon: favIconUrl })
  }
}

// ─── Offline queue ────────────────────────────────────────────────────────────
async function queueCapture(item) {
  const stored = await chrome.storage.local.get(QUEUE_KEY)
  const queue = stored[QUEUE_KEY] || []
  // Avoid duplicates in queue
  if (!queue.find(q => q.url === item.url)) {
    queue.push({ ...item, queuedAt: new Date().toISOString() })
    // Keep max 500 items
    if (queue.length > 500) queue.splice(0, queue.length - 500)
    await chrome.storage.local.set({ [QUEUE_KEY]: queue })
  }
}

async function flushQueue() {
  const config = await getConfig()
  if (!config.enabled || !config.userId) return

  const stored = await chrome.storage.local.get(QUEUE_KEY)
  const queue = stored[QUEUE_KEY] || []
  if (queue.length === 0) return

  const sent = []
  for (const item of queue) {
    try {
      const res = await fetch(`${config.apiUrl}/api/memory/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          title: item.title,
          favicon: item.favicon || null,
          timestamp: item.queuedAt || new Date().toISOString(),
          source: 'chrome-extension',
          user_id: config.userId,
        }),
      })
      if (res.ok) sent.push(item.url)
    } catch { break } // stop if server is down
  }

  if (sent.length > 0) {
    const remaining = queue.filter(q => !sent.includes(q.url))
    await chrome.storage.local.set({ [QUEUE_KEY]: remaining })
    console.log(`[LiveMemory] Flushed ${sent.length} queued items`)
  }
}

// ─── Tab event listeners ──────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url && shouldCapture(tab.url)) {
      await captureUrl(tab.url, tab.title, tab.favIconUrl)
    }
  } catch { /* tab may have been closed */ }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only capture when page is fully loaded
  if (changeInfo.status !== 'complete') return
  if (!tab.url || !shouldCapture(tab.url)) return
  await captureUrl(tab.url, tab.title, tab.favIconUrl)
})

// ─── Periodic queue flush (every 5 min) ──────────────────────────────────────
chrome.alarms.create('flushQueue', { periodInMinutes: 5 })
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'flushQueue') flushQueue()
})

// Flush on startup too
flushQueue()

// ─── Keepalive port (from content script) ────────────────────────────────────
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'keepalive') {
    port.onDisconnect.addListener(() => {}) // just keep the port open
  }
})

// ─── Message handler (from popup) ────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    Promise.all([getConfig(), chrome.storage.local.get(QUEUE_KEY)]).then(([config, stored]) => {
      sendResponse({ config, queueLength: (stored[QUEUE_KEY] || []).length })
    })
    return true // async
  }
  if (msg.type === 'SAVE_CONFIG') {
    chrome.storage.local.set({ [STORAGE_KEY]: msg.config }).then(() => {
      flushQueue() // try to flush with new config
      sendResponse({ ok: true })
    })
    return true
  }
  if (msg.type === 'FLUSH_QUEUE') {
    flushQueue().then(() => sendResponse({ ok: true }))
    return true
  }
})

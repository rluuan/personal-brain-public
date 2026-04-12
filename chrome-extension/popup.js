// Personal Brain - Live Memory Popup

async function loadStatus() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, resolve)
  })
}

async function saveConfig(config) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config }, resolve)
  })
}

async function flushQueue() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'FLUSH_QUEUE' }, resolve)
  })
}

const DEFAULT_API_URL = 'http://localhost:3001'

async function checkConnection() {
  try {
    const res = await fetch(`${DEFAULT_API_URL}/api/config`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch { return false }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const userIdEl   = document.getElementById('userId')
  const enabledEl  = document.getElementById('enabled')
  const statusDot  = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const queueBadge = document.getElementById('queueBadge')
  const saveBtn    = document.getElementById('saveBtn')
  const flushBtn   = document.getElementById('flushBtn')
  const successMsg = document.getElementById('successMsg')

  // Load current config
  const { config, queueLength } = await loadStatus()
  userIdEl.value    = config.userId  || ''
  enabledEl.checked = config.enabled !== false

  // Update queue badge
  queueBadge.textContent = queueLength
  queueBadge.className = `queue-badge${queueLength === 0 ? ' empty' : ''}`

  // Check connection
  const isOnline = await checkConnection()
  statusDot.className = `dot ${isOnline ? 'online' : 'offline'}`
  statusText.textContent = isOnline ? 'Conectado ao Personal Brain' : 'Servidor não encontrado'

  // Save button
  saveBtn.addEventListener('click', async () => {
    const newConfig = {
      apiUrl:  DEFAULT_API_URL,
      userId:  userIdEl.value.trim(),
      enabled: enabledEl.checked,
    }
    await saveConfig(newConfig)
    successMsg.style.display = 'block'
    setTimeout(() => successMsg.style.display = 'none', 2000)

    // Re-check connection
    const online = await checkConnection()
    statusDot.className = `dot ${online ? 'online' : 'offline'}`
    statusText.textContent = online ? 'Conectado ao Personal Brain' : 'Servidor não encontrado'
  })

  // Flush button
  flushBtn.addEventListener('click', async () => {
    flushBtn.textContent = 'Enviando...'
    flushBtn.disabled = true
    await flushQueue()
    // Small delay to let the background finish
    await new Promise(r => setTimeout(r, 800))
    const { queueLength: newLen } = await loadStatus()
    queueBadge.textContent = newLen
    queueBadge.className = `queue-badge${newLen === 0 ? ' empty' : ''}`
    flushBtn.textContent = newLen === 0 ? '✓ Fila enviada!' : 'Enviar fila agora'
    setTimeout(() => { flushBtn.textContent = 'Enviar fila agora' }, 2000)
    flushBtn.disabled = false
  })
})

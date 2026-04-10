const API_BASE = `http://${window.location.hostname}:3001/api`

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export const apiService = {
  // Config
  getConfig: () => request('/config'),
  saveConfig: (cfg) => request('/config', { method: 'POST', body: JSON.stringify(cfg) }),

  // Users
  login: (nickname) => request('/users/login', { method: 'POST', body: JSON.stringify({ nickname }) }),

  // Notes
  getNotes: (userId) => request(`/notes?user_id=${userId}`),
  createNote: (note) => request('/notes', { method: 'POST', body: JSON.stringify(note) }),
  updateNote: (id, changes) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(changes) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

  // Folders
  getFolders: (userId) => request(`/folders?user_id=${userId}`),
  createFolder: (folder) => request('/folders', { method: 'POST', body: JSON.stringify(folder) }),
  updateFolder: (id, name) => request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: (userId) => request(`/settings/${userId}`),
  saveSettings: (userId, settings) => request(`/settings/${userId}`, { method: 'PUT', body: JSON.stringify(settings) }),

  // AI & Ollama
  getOllamaStatus: () => request('/ollama/status'),
  getCritique: (notes, aiModel) => request('/critique', { method: 'POST', body: JSON.stringify({ notes, ai_model: aiModel }) }),
  scrapeUrl: (url, useAI, aiModel) => request('/scrape', { method: 'POST', body: JSON.stringify({ url, useAI, ai_model: aiModel }) }),
  
  // RAG / Sync
  getSyncStatus: (userId) => request(`/sync/status?user_id=${userId}`),

  // Export
  exportNotes: (userId, notes, folders) => request('/export/notes', { method: 'POST', body: JSON.stringify({ user_id: userId, notes, folders }) }),
  exportDb: (format) => request('/export/db', { method: 'POST', body: JSON.stringify({ format }) }),
  revealInExplorer: (path) => request('/export/reveal', { method: 'POST', body: JSON.stringify({ path }) }),
}

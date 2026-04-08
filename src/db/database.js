const API = `http://${window.location.hostname}:3001/api`

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// ─── no-op: compatibilidade com useNotesStore ────────────────────────────────
export async function initDb() {}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function dbGetOrCreateUser(nickname) {
  return req('POST', '/users/login', { nickname })
}

// ─── Notes ───────────────────────────────────────────────────────────────────
export async function dbGetNotes(userId) {
  return req('GET', `/notes?user_id=${encodeURIComponent(userId)}`)
}

export async function dbCreateNote(note) {
  return req('POST', '/notes', note)
}

export async function dbUpdateNote(id, changes) {
  return req('PUT', `/notes/${encodeURIComponent(id)}`, changes)
}

export async function dbDeleteNote(id) {
  return req('DELETE', `/notes/${encodeURIComponent(id)}`)
}

// ─── Folders ─────────────────────────────────────────────────────────────────
export async function dbGetFolders(userId) {
  return req('GET', `/folders?user_id=${encodeURIComponent(userId)}`)
}

export async function dbCreateFolder(folder) {
  return req('POST', '/folders', folder)
}

export async function dbUpdateFolder(id, name) {
  return req('PUT', `/folders/${encodeURIComponent(id)}`, { name })
}

export async function dbDeleteFolder(id) {
  return req('DELETE', `/folders/${encodeURIComponent(id)}`)
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function dbGetSettings(userId) {
  return req('GET', `/settings/${encodeURIComponent(userId)}`)
}

export async function dbSaveSettings(userId, settings) {
  return req('PUT', `/settings/${encodeURIComponent(userId)}`, settings)
}

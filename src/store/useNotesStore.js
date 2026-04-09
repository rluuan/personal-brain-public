import { create } from 'zustand'
import {
  initDb, dbGetOrCreateUser,
  dbGetNotes, dbCreateNote, dbUpdateNote, dbDeleteNote,
  dbGetFolders, dbCreateFolder, dbUpdateFolder, dbDeleteFolder,
  dbGetSettings, dbSaveSettings,
} from '../db/database'
import {
  encryptText, decryptText, encryptNote, decryptNotes,
  isEncrypted, localStorageKey,
} from '../crypto'

const COOKIE_NAME = 'personal-brain-user'
const COOKIE_DAYS = 365
const ACTIVE_NOTE_KEY = 'personal-brain-active-note'
const OPEN_TABS_KEY   = 'personal-brain-open-tabs'

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

export const useNotesStore = create((set, get) => ({
  notes: [],          // always plaintext in memory
  folders: [],
  activeNoteId: null,
  openTabs: [],       // ordered array of note IDs currently open as tabs
  loading: true,
  user: null,         // { id, nickname }
  encryptionKey: null, // raw passphrase — never leaves the browser
  settings: { primaryColor: '#cba6f7', secondaryColor: '#89b4fa', extra: { projectName: 'Personal Brain', aiModel: 'gemma3:12b', embedModel: 'nomic-embed-text' } },

  // ── Boot ──────────────────────────────────────────────────────────────
  load: async () => {
    await initDb()
    const savedNick = getCookie(COOKIE_NAME)
    if (savedNick) {
      await get().loginUser(savedNick)
    } else {
      set({ loading: false })
    }
  },

  loginUser: async (nickname) => {
    const user = await dbGetOrCreateUser(nickname)
    setCookie(COOKIE_NAME, nickname, COOKIE_DAYS)
    const [rawNotes, folders, rawSettings] = await Promise.all([
      dbGetNotes(user.id),
      dbGetFolders(user.id),
      dbGetSettings(user.id).catch(() => null),
    ])
        const settings = rawSettings
      ? { 
          primaryColor: rawSettings.primary_color, 
          secondaryColor: rawSettings.secondary_color, 
          extra: { 
            projectName: 'Personal Brain', 
            aiModel: 'gemma3:12b', 
            embedModel: 'nomic-embed-text',
            ...(rawSettings.extra || {}) 
          } 
        }
      : { primaryColor: '#cba6f7', secondaryColor: '#89b4fa', extra: { projectName: 'Personal Brain', aiModel: 'gemma3:12b', embedModel: 'nomic-embed-text' } }

    // Check if user already has an encryption key saved on this device
    const savedKey = localStorage.getItem(localStorageKey(user.id))
    let notes = rawNotes
    let encryptionKey = null

    if (savedKey) {
      encryptionKey = savedKey
      notes = await decryptNotes(rawNotes, savedKey, user.id)
    }

    // Restore last active note from localStorage, fallback to first note
    const savedActiveId = localStorage.getItem(ACTIVE_NOTE_KEY)
    const restoredActiveId = savedActiveId && notes.find(n => n.id === savedActiveId)
      ? savedActiveId
      : (notes[0]?.id || null)

    // Restore open tabs
    const savedTabs = JSON.parse(localStorage.getItem(OPEN_TABS_KEY) || '[]')
    const validTabs = savedTabs.filter(id => notes.find(n => n.id === id))
    const openTabs = validTabs.length > 0 ? validTabs : (restoredActiveId ? [restoredActiveId] : [])

    set({
      user,
      notes,
      folders,
      settings,
      encryptionKey,
      loading: false,
      activeNoteId: restoredActiveId,
      openTabs,
    })

    // Apply saved font family
    const savedFont = settings.extra?.fontFamily
    if (savedFont) document.body.style.fontFamily = `'${savedFont}', sans-serif`
  },

  /**
   * Called from KeyModal once user enters their key.
   * - Saves key to localStorage
   * - Decrypts any encrypted notes already in state
   * - Encrypts any plaintext notes that aren't encrypted in the DB yet (migration)
   */
  setEncryptionKey: async (key) => {
    const { user, notes } = get()
    if (!user) return

    localStorage.setItem(localStorageKey(user.id), key)

    // Decrypt notes that are still ciphertext (e.g. returning user, key was missing)
    // and encrypt notes that are plaintext (migration for existing users)
    const decrypted = await Promise.all(
      notes.map(async (n) => {
        const decTitle   = isEncrypted(n.title)   ? await decryptText(n.title,   key, user.id) : n.title
        const decContent = isEncrypted(n.content) ? await decryptText(n.content, key, user.id) : n.content
        return { ...n, title: decTitle, content: decContent }
      })
    )

    // Encrypt all plaintext notes in the DB (one-time migration)
    await Promise.all(
      notes.map(async (rawNote, i) => {
        const needsEncTitle   = !isEncrypted(rawNote.title)
        const needsEncContent = !isEncrypted(rawNote.content)
        if (needsEncTitle || needsEncContent) {
          const encTitle   = needsEncTitle   ? await encryptText(decrypted[i].title,   key, user.id) : rawNote.title
          const encContent = needsEncContent ? await encryptText(decrypted[i].content, key, user.id) : rawNote.content
          await dbUpdateNote(rawNote.id, { title: encTitle, content: encContent })
        }
      })
    )

    set({ encryptionKey: key, notes: decrypted })
  },

  logout: () => {
    const { user } = get()
    deleteCookie(COOKIE_NAME)
    if (user) localStorage.removeItem(localStorageKey(user.id))
    localStorage.removeItem(OPEN_TABS_KEY)
    set({
      user: null,
      notes: [],
      folders: [],
      activeNoteId: null,
      openTabs: [],
      encryptionKey: null,
      settings: { primaryColor: '#cba6f7', secondaryColor: '#89b4fa', extra: { projectName: 'Personal Brain', aiModel: 'gemma3:12b', embedModel: 'nomic-embed-text' } },
    })
  },

  saveSettings: async (newSettings) => {
    const { user } = get()
    if (!user) return
    await dbSaveSettings(user.id, {
      primary_color: newSettings.primaryColor,
      secondary_color: newSettings.secondaryColor,
      extra: newSettings.extra || {},
    })
    set({ settings: newSettings })
  },

  // ── Notes ─────────────────────────────────────────────────────────────
  setActiveNote: (id) => {
    localStorage.setItem(ACTIVE_NOTE_KEY, id)
    set((state) => {
      const openTabs = state.openTabs.includes(id) ? state.openTabs : [...state.openTabs, id]
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(openTabs))
      return { activeNoteId: id, openTabs }
    })
  },

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.openTabs.filter(t => t !== id)
      let newActive = state.activeNoteId
      if (state.activeNoteId === id) {
        const idx = state.openTabs.indexOf(id)
        newActive = newTabs[idx] ?? newTabs[idx - 1] ?? null
      }
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(newTabs))
      if (newActive) localStorage.setItem(ACTIVE_NOTE_KEY, newActive)
      return { openTabs: newTabs, activeNoteId: newActive }
    })
  },

  getActiveNote: () => {
    const { notes, activeNoteId } = get()
    return notes.find((n) => n.id === activeNoteId) || null
  },

  createNote: async (title = 'Sem Título', folderId = null, initialContent = null) => {
    const { user, encryptionKey } = get()
    const id = `${user.id}-n-${Date.now()}`
    const plainContent = initialContent !== null ? initialContent : `# ${title}\n\n`

    // What gets stored in DB — encrypted if key available
    const dbTitle   = encryptionKey ? await encryptText(title,        encryptionKey, user.id) : title
    const dbContent = encryptionKey ? await encryptText(plainContent, encryptionKey, user.id) : plainContent

    const dbNote = {
      id, user_id: user.id,
      title: dbTitle,
      content: dbContent,
      folder_id: folderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await dbCreateNote(dbNote)

    // In-memory note always stores plaintext
    const memNote = { ...dbNote, title, content: plainContent }
    set((state) => {
      const openTabs = [...state.openTabs, id]
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(openTabs))
      localStorage.setItem(ACTIVE_NOTE_KEY, id)
      return { notes: [memNote, ...state.notes], activeNoteId: id, openTabs }
    })
    return id
  },

  updateNote: async (id, changes) => {
    const { encryptionKey, user } = get()
    let dbChanges = { ...changes }

    if (encryptionKey) {
      if (changes.title !== undefined) {
        dbChanges.title = await encryptText(changes.title, encryptionKey, user.id)
      }
      if (changes.content !== undefined) {
        dbChanges.content = await encryptText(changes.content, encryptionKey, user.id)
      }
    }

    await dbUpdateNote(id, dbChanges)
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, ...changes, updated_at: new Date().toISOString() } : n
      ),
    }))
  },

  deleteNote: async (id) => {
    await dbDeleteNote(id)
    set((state) => {
      const remaining = state.notes.filter((n) => n.id !== id)
      const newTabs = state.openTabs.filter(t => t !== id)
      let newActive = state.activeNoteId
      if (state.activeNoteId === id) {
        const idx = state.openTabs.indexOf(id)
        newActive = newTabs[idx] ?? newTabs[idx - 1] ?? null
      }
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(newTabs))
      if (newActive) localStorage.setItem(ACTIVE_NOTE_KEY, newActive)
      return { notes: remaining, openTabs: newTabs, activeNoteId: newActive }
    })
  },

  renameNote: async (id, title) => {
    const { encryptionKey, user } = get()
    const dbTitle = encryptionKey ? await encryptText(title, encryptionKey, user.id) : title
    await dbUpdateNote(id, { title: dbTitle })
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, title, updated_at: new Date().toISOString() } : n
      ),
    }))
  },

  moveNote: async (noteId, folderId) => {
    await dbUpdateNote(noteId, { folder_id: folderId })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === noteId ? { ...n, folder_id: folderId } : n)),
    }))
  },

  // ── Folders ───────────────────────────────────────────────────────────
  createFolder: async (name, parentId = null) => {
    const { user } = get()
    const id = `${user.id}-f-${Date.now()}`
    const folder = { id, user_id: user.id, name, parent_id: parentId, created_at: new Date().toISOString() }
    await dbCreateFolder(folder)
    set((state) => ({ folders: [...state.folders, folder] }))
    return id
  },

  renameFolder: async (id, name) => {
    await dbUpdateFolder(id, name)
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }))
  },

  deleteFolder: async (id) => {
    await dbDeleteFolder(id)
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id && f.parent_id !== id),
      notes: state.notes.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)),
    }))
  },

  // ── Daily Note ────────────────────────────────────────────────────────
  openDailyNote: async () => {
    const now   = new Date()
    const year  = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day   = String(now.getDate()).padStart(2, '0')
    const noteTitle = `${year}-${month}-${day}`

    // Year folder (root)
    let yearFolder = get().folders.find(f => f.name === year && !f.parent_id)
    if (!yearFolder) {
      const yid = await get().createFolder(year, null)
      yearFolder = get().folders.find(f => f.id === yid)
    }

    // Month folder
    let monthFolder = get().folders.find(f => f.name === month && f.parent_id === yearFolder.id)
    if (!monthFolder) {
      const mid = await get().createFolder(month, yearFolder.id)
      monthFolder = get().folders.find(f => f.id === mid)
    }

    // Day folder
    let dayFolder = get().folders.find(f => f.name === day && f.parent_id === monthFolder.id)
    if (!dayFolder) {
      const did = await get().createFolder(day, monthFolder.id)
      dayFolder = get().folders.find(f => f.id === did)
    }

    // Note
    const existing = get().notes.find(n => n.title === noteTitle && n.folder_id === dayFolder.id)
    if (existing) {
      get().setActiveNote(existing.id)
    } else {
      await get().createNote(noteTitle, dayFolder.id, `# ${noteTitle}\n\n`)
    }
  },

  // ── Helpers ───────────────────────────────────────────────────────────
  getNoteByTitle: (title) => {
    const { notes } = get()
    return notes.find((n) => n.title.toLowerCase() === title.toLowerCase()) || null
  },

  getLinks: (content) => {
    const matches = [...(content || '').matchAll(/\[\[([^\]]+)\]\]/g)]
    return matches.map((m) => m[1])
  },

  getBacklinks: (noteId) => {
    const { notes, getLinks } = get()
    const target = notes.find((n) => n.id === noteId)
    if (!target) return []
    return notes.filter((note) => {
      if (note.id === noteId) return false
      return getLinks(note.content).some((l) => l.toLowerCase() === target.title.toLowerCase())
    })
  },

  extractTags: (content) => {
    const matches = [...(content || '').matchAll(/#(\w+)/g)]
    return [...new Set(matches.map((m) => m[1]))]
  },

  getAllTags: () => {
    const { notes, extractTags } = get()
    const tagSet = new Set()
    notes.forEach((n) => extractTags(n.content).forEach((t) => tagSet.add(t)))
    return [...tagSet]
  },

  // ── Export ────────────────────────────────────────────────────────────
  exportNotesAsMd: async (notes, folders) => {
    const user_id = get().user?.id
    const res = await fetch('http://' + window.location.hostname + ':3001/api/export/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, notes, folders }),
    })
    return res.json()
  },

  exportDb: async (format = 'json') => {
    const res = await fetch('http://' + window.location.hostname + ':3001/api/export/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    })
    const data = await res.json()
    return data
  },

  // ── Server Config ─────────────────────────────────────────────────────
  getServerConfig: async () => {
    const res = await fetch('http://' + window.location.hostname + ':3001/api/config')
    return res.json()
  },

  saveServerConfig: async (config) => {
    const res = await fetch('http://' + window.location.hostname + ':3001/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    return res.json()
  },
}))

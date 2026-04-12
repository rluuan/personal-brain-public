import { create } from 'zustand'
import { 
  initDb, 
  dbGetNotes, 
  dbGetFolders, 
  dbGetSettings,
  dbGetOrCreateUser
} from '../db/database'
import { 
  decryptNotes, 
  localStorageKey 
} from '../crypto'
import { 
  COOKIE_NAME, 
  ACTIVE_NOTE_KEY, 
  OPEN_TABS_KEY, 
  getCookie, 
  setCookie,
  NOVIDADES_CONTENT
} from './utils'

import { createUserSlice } from './slices/userSlice'
import { createNotesSlice } from './slices/notesSlice'
import { createFoldersSlice } from './slices/foldersSlice'
import { createSettingsSlice } from './slices/settingsSlice'
import { createLiveMemorySlice } from './slices/liveMemorySlice'

export const useNotesStore = create((set, get) => ({
  ...createUserSlice(set, get),
  ...createNotesSlice(set, get),
  ...createFoldersSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createLiveMemorySlice(set, get),

  // ── Orchestration ──────────────────────────────────────────────────────
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
    // 1. Get/Create User
    const user = await dbGetOrCreateUser(nickname)
    setCookie(COOKIE_NAME, nickname, 365)

    // 2. Load basic data
    const [rawNotes, folders, rawSettings] = await Promise.all([
      dbGetNotes(user.id),
      dbGetFolders(user.id),
      dbGetSettings(user.id).catch(() => null),
    ])

    // 3. Process Settings
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

    // 4. Handle Encryption
    const savedKey = localStorage.getItem(localStorageKey(user.id))
    let notes = rawNotes
    let encryptionKey = null

    if (savedKey) {
      encryptionKey = savedKey
      notes = await decryptNotes(rawNotes, savedKey, user.id)
    }

    // 5. Restore State (Active note & Tabs)
    const savedActiveId = localStorage.getItem(ACTIVE_NOTE_KEY)
    const restoredActiveId = savedActiveId && notes.find(n => n.id === savedActiveId)
      ? savedActiveId
      : (notes[0]?.id || null)

    const savedTabs = JSON.parse(localStorage.getItem(OPEN_TABS_KEY) || '[]')
    const validTabs = savedTabs.filter(id => notes.find(n => n.id === id))
    const openTabs = validTabs.length > 0 ? validTabs : (restoredActiveId ? [restoredActiveId] : [])

    // 6. Final State Set
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

    // Start SSE stream for live memories
    get().startLiveMemoryStream()
  },

  // Called from App after first render — avoids race with Editor mount
  checkNovidades: async () => {
    const { settings, notes } = get()
    if (settings.extra?.ignoreNovidades) return
    const NOVIDADES_TITLE = '🚀 Últimas Novidades'
    const existing = notes.find(n => n.title === NOVIDADES_TITLE)
    if (!existing) {
      await get().createNote(NOVIDADES_TITLE, null, NOVIDADES_CONTENT)
    } else {
      get().setActiveNote(existing.id)
    }
  },
}))

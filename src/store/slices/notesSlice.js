import { dbCreateNote, dbUpdateNote, dbDeleteNote } from '../../db/database'
import { encryptText, decryptText, isEncrypted, localStorageKey } from '../../crypto'
import { ACTIVE_NOTE_KEY, OPEN_TABS_KEY } from '../utils'
import { getLinks, extractTags } from '../../utils/markdownUtils'
import { dailyNoteService } from '../../services/dailyNoteService'
import { apiService } from '../../services/apiService'

export const createNotesSlice = (set, get) => ({
  notes: [],          // always plaintext in memory
  activeNoteId: null,
  openTabs: [],       // ordered array of note IDs currently open as tabs
  encryptionKey: null, // raw passphrase — never leaves the browser

  setNotes: (notes) => set({ notes }),
  setEncryptionKeyData: (key) => set({ encryptionKey: key }),

  getAllTags: () => {
    const { notes } = get()
    const tags = new Set()
    notes.forEach((n) => {
      const matches = [...(n.content || '').matchAll(/#(\w+)/g)]
      matches.forEach((m) => tags.add(m[1]))
    })
    return Array.from(tags).sort()
  },

  getBacklinks: (title) => {
    const { notes } = get()
    if (!title) return []
    return notes.filter((n) => (n.content || '').includes(`[[${title}]]`))
  },

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

  getNoteByTitle: (title) => {
    const { notes } = get()
    return notes.find((n) => n.title.toLowerCase() === title.toLowerCase()) || null
  },

  createNote: async (title = 'Sem Título', folderId = null, initialContent = null) => {
    const { user, encryptionKey } = get()
    if (!user) return
    const id = `${user.id}-n-${Date.now()}`
    const plainContent = initialContent !== null ? initialContent : `# ${title}\n\n`

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

    if (encryptionKey && user) {
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

  setEncryptionKey: async (key) => {
    const { user, notes } = get()
    if (!user) return

    localStorage.setItem(localStorageKey(user.id), key)

    const decrypted = await Promise.all(
      notes.map(async (n) => {
        const decTitle   = isEncrypted(n.title)   ? await decryptText(n.title,   key, user.id) : n.title
        const decContent = isEncrypted(n.content) ? await decryptText(n.content, key, user.id) : n.content
        return { ...n, title: decTitle, content: decContent }
      })
    )

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
  
  openDailyNote: () => dailyNoteService.ensureDailyNotePath(get),
  getLinks: (content) => getLinks(content),
  extractTags: (content) => extractTags(content),

  exportNotesAsMd: async (notes, folders) => {
    const { user } = get()
    if (!user) throw new Error('Usuário não logado')
    return await apiService.exportNotes(user.id, notes, folders)
  },

  exportDb: async (format) => {
    return await apiService.exportDb(format)
  },

  revealInExplorer: async (path) => {
    return await apiService.revealInExplorer(path)
  },
})

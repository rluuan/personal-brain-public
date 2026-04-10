import { dbCreateFolder, dbUpdateFolder, dbDeleteFolder } from '../../db/database'

export const createFoldersSlice = (set, get) => ({
  folders: [],

  setFolders: (folders) => set({ folders }),

  createFolder: async (name, parentId = null) => {
    const { user } = get()
    if (!user) return
    const id = `${user.id}-f-${Date.now()}`
    const folder = { 
      id, 
      user_id: user.id, 
      name, 
      parent_id: parentId, 
      created_at: new Date().toISOString() 
    }
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
      // Note: notes folder_id nulling is handled in notesSlice or via state update here if needed
      notes: state.notes.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n)),
    }))
  },
})

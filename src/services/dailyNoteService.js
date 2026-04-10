export const dailyNoteService = {
  getDailyNoteTitle: () => {
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return { year, month, day, title: `${year}-${month}-${day}` }
  },

  // getStore is the zustand `get` function — called fresh after each async op
  ensureDailyNotePath: async (getStore) => {
    const { year, month, day, title } = dailyNoteService.getDailyNoteTitle()

    // Year folder (root)
    let s = getStore()
    let yearFolder = s.folders.find(f => f.name === year && !f.parent_id)
    if (!yearFolder) {
      const yid = await s.createFolder(year, null)
      yearFolder = getStore().folders.find(f => f.id === yid)
    }

    // Month folder
    s = getStore()
    let monthFolder = s.folders.find(f => f.name === month && f.parent_id === yearFolder.id)
    if (!monthFolder) {
      const mid = await s.createFolder(month, yearFolder.id)
      monthFolder = getStore().folders.find(f => f.id === mid)
    }

    // Day folder
    s = getStore()
    let dayFolder = s.folders.find(f => f.name === day && f.parent_id === monthFolder.id)
    if (!dayFolder) {
      const did = await s.createFolder(day, monthFolder.id)
      dayFolder = getStore().folders.find(f => f.id === did)
    }

    // Note
    s = getStore()
    const existing = s.notes.find(n => n.title === title && n.folder_id === dayFolder.id)
    if (existing) {
      s.setActiveNote(existing.id)
    } else {
      await s.createNote(title, dayFolder.id, `# ${title}\n\n`)
    }
  }
}

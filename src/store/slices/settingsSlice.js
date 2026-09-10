import { dbSaveSettings } from '../../db/database'
import { apiService } from '../../services/apiService'
import { slugifyStatus, FOLDER_COLORS } from '../../utils/sidebarOptions'

export const createSettingsSlice = (set, get) => ({
  settings: { 
    primaryColor: '#cba6f7', 
    secondaryColor: '#89b4fa', 
    extra: { 
      projectName: 'Personal Brain', 
      aiModel: 'gemma3:12b', 
      embedModel: 'nomic-embed-text' 
    } 
  },

  getServerConfig: async () => {
    try {
      return await apiService.getConfig()
    } catch (e) {
      console.error('Error fetching server config:', e)
      return null
    }
  },

  saveServerConfig: async (config) => {
    try {
      await apiService.saveConfig(config)
      return true
    } catch (e) {
      console.error('Error saving server config:', e)
      return false
    }
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
  
  setSettings: (settings) => set({ settings }),

  setTagColor: async (tag, color) => {
    const { settings, saveSettings } = get()
    const tagColors = { ...(settings.extra?.tagColors || {}), [tag]: color }
    await saveSettings({ ...settings, extra: { ...settings.extra, tagColors } })
  },

  addCustomStatus: async (label, color) => {
    const { settings, saveSettings, getAllStatuses } = get()
    const trimmed = label.trim()
    if (!trimmed) return null
    const existing = getAllStatuses()
    let id = slugifyStatus(trimmed)
    if (existing.some((s) => s.id === id)) id = `${id}_${Date.now()}`
    const newStatus = { id, label: trimmed, color: color || FOLDER_COLORS[existing.length % FOLDER_COLORS.length] }
    const customStatuses = [...(settings.extra?.customStatuses || []), newStatus]
    await saveSettings({ ...settings, extra: { ...settings.extra, customStatuses } })
    return id
  },
})

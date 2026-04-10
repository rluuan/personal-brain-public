import { dbSaveSettings } from '../../db/database'
import { apiService } from '../../services/apiService'

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
})

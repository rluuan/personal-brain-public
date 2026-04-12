import { dbGetLiveMemories, dbDeleteLiveMemory, dbDeleteLiveMemoriesBulk } from '../../db/database'

let sseSource = null

export const createLiveMemorySlice = (set, get) => ({
  liveMemories: [],
  liveMemoryTotal: 0,

  fetchLiveMemories: async ({ page = 1, limit = 25, q } = {}) => {
    const { user } = get()
    if (!user) return
    try {
      const data = await dbGetLiveMemories(user.id, { page, limit, q })
      set({ liveMemories: data.items, liveMemoryTotal: data.total })
      return data
    } catch (e) {
      console.error('fetchLiveMemories:', e)
    }
  },

  startLiveMemoryStream: () => {
    const { user } = get()
    if (!user || sseSource) return
    const base = `${window.location.protocol}//${window.location.hostname}:3001`
    sseSource = new EventSource(`${base}/api/memory/live/stream?user_id=${user.id}`)
    sseSource.onmessage = (e) => {
      console.log('[SSE] mensagem recebida:', e.data)
      const data = JSON.parse(e.data)
      if (data.type === 'new') {
        set(state => ({
          liveMemories: [data, ...state.liveMemories],
          liveMemoryTotal: state.liveMemoryTotal + 1,
        }))
      }
    }
    sseSource.onerror = () => {
      sseSource?.close()
      sseSource = null
      // reconnect after 5s
      setTimeout(() => get().startLiveMemoryStream(), 5000)
    }
  },

  stopLiveMemoryStream: () => {
    sseSource?.close()
    sseSource = null
  },

  deleteLiveMemory: async (id) => {
    const { user } = get()
    if (!user) return
    await dbDeleteLiveMemory(id, user.id)
    set(state => ({ liveMemories: state.liveMemories.filter(m => m.id !== id) }))
  },

  deleteLiveMemoriesBulk: async (ids) => {
    const { user } = get()
    if (!user) return
    await dbDeleteLiveMemoriesBulk(user.id, ids)
    set(state => ({ liveMemories: state.liveMemories.filter(m => !ids.includes(m.id)) }))
  },
})

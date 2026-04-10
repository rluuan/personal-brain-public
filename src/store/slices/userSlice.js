import { dbGetOrCreateUser } from '../../db/database'
import { localStorageKey } from '../../crypto'
import { COOKIE_NAME, COOKIE_DAYS, setCookie, deleteCookie, getCookie } from '../utils'

export const createUserSlice = (set, get) => ({
  user: null, // { id, nickname }
  loading: true,

  loginUser: async (nickname) => {
    const user = await dbGetOrCreateUser(nickname)
    setCookie(COOKIE_NAME, nickname, COOKIE_DAYS)
    
    // We delegate the data loading to the root load function or subsequent calls
    // but the user state is set here.
    set({ user })
    return user
  },

  logout: () => {
    const { user } = get()
    deleteCookie(COOKIE_NAME)
    if (user) localStorage.removeItem(localStorageKey(user.id))
    
    // Clear state
    set({
      user: null,
      notes: [],
      folders: [],
      activeNoteId: null,
      openTabs: [],
      encryptionKey: null,
    })
  },
  
  setLoading: (loading) => set({ loading }),
})

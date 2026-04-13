const API = `http://${window.location.hostname}:3001`

export const createClaudeMemorySlice = (set, get) => ({
  claudeNodes:    [],
  claudeLinks:    [],   // { source, target, type } para session↔subagent↔memory
  claudeProjects: [],

  fetchClaudeProjects: async () => {
    try {
      const res = await fetch(`${API}/api/claude/projects`)
      const data = await res.json()
      set({ claudeProjects: data.projects || [] })
    } catch { /* ignore */ }
  },

  fetchClaudeNodes: async () => {
    const { user } = get()
    if (!user) return
    try {
      const res = await fetch(`${API}/api/claude/nodes?user_id=${user.id}`)
      const data = await res.json()
      set({ claudeNodes: data.nodes || [] })
    } catch { /* ignore */ }
  },

  syncClaudeProject: async (projectName) => {
    const { user } = get()
    if (!user) return { synced: 0 }
    try {
      const res = await fetch(`${API}/api/claude/sync/${encodeURIComponent(projectName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const data = await res.json()
      if (data.nodes) {
        // Incremental: replace nodes for this project, keep others
        set(state => ({
          claudeNodes: [
            ...state.claudeNodes.filter(n => n.project !== projectName),
            ...data.nodes,
          ],
          claudeLinks: [
            ...state.claudeLinks.filter(l => !l.source.startsWith(`claude-${projectName}-`)),
            ...(data.links || []),
          ],
        }))
      }
      return data
    } catch (e) {
      return { error: e.message }
    }
  },

  addClaudeNode: async ({ project, summary, content, tags }) => {
    const { user } = get()
    if (!user) return
    try {
      const res = await fetch(`${API}/api/claude/node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, project, summary, content, tags }),
      })
      const data = await res.json()
      if (data.node) {
        set(state => ({ claudeNodes: [data.node, ...state.claudeNodes] }))
      }
      return data.node
    } catch { /* ignore */ }
  },

  startClaudeStream: () => {
    const { user } = get()
    if (!user) return
    const es = new EventSource(`${API}/api/claude/stream?user_id=${user.id}`)
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data)
        if (evt.type === 'node') {
          set(state => {
            const exists = state.claudeNodes.some(n => n.id === evt.node.id)
            if (exists) return {}
            return { claudeNodes: [evt.node, ...state.claudeNodes] }
          })
        }
      } catch { /* ignore */ }
    }
    return () => es.close()
  },
})

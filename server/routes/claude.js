import express from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getSqlite, isSqlite } from '../db/connection.js'

const router = express.Router()

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects')

// ── SSE clients registry ──────────────────────────────────────────────────────
const sseClients = new Set()

function broadcastNode(node) {
  const data = `data: ${JSON.stringify({ type: 'node', node })}\n\n`
  sseClients.forEach(res => { try { res.write(data) } catch { sseClients.delete(res) } })
}

// ── Project name: decode folder name → clean project name ────────────────────
// Folder encoding: drive:\Users\{user}\Documents\{user}\{project}
//              → drive--Users-{user}-Documents-{user}-{project}
// We extract only the project name at the end.
function folderToProjectName(folderName) {
  // Match: letter--Users-{user}-Documents-{user}-{rest}
  const m = folderName.match(/^[A-Za-z]--Users-[^-]+-Documents-[^-]+-(.+)$/i)
  if (m) return m[1]
  // If it's just the Documents folder or Users folder, return raw (filtered out later)
  return folderName
}

// Only show projects that are actual project dirs (not home/documents)
function isValidProject(folderName) {
  return /^[A-Za-z]--Users-[^-]+-Documents-[^-]+-/.test(folderName)
}

// ── DB helpers ────────────────────────────────────────────────────────────────
function dbGetNodes(userId) {
  if (!isSqlite()) return []
  return getSqlite().prepare(
    'SELECT * FROM claude_memory_nodes WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId)
}

function dbInsertNode(node) {
  if (!isSqlite()) return
  getSqlite().prepare(`
    INSERT OR IGNORE INTO claude_memory_nodes (id, user_id, project, summary, content, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(node.id, node.user_id, node.project, node.summary, node.content, JSON.stringify(node.tags || []), node.created_at)
}

function dbDeleteNodesByProject(userId, project) {
  if (!isSqlite()) return
  getSqlite().prepare('DELETE FROM claude_memory_nodes WHERE user_id = ? AND project = ?').run(userId, project)
}

// ── Extract text from message content ────────────────────────────────────────
function extractText(content, maxLen = 200) {
  if (!content) return ''
  if (typeof content === 'string') return content.trim().slice(0, maxLen)
  if (Array.isArray(content)) {
    return content
      .filter(b => b && b.type === 'text')
      .map(b => b.text || '')
      .join(' ')
      .trim()
      .slice(0, maxLen)
  }
  return ''
}

function makeSummary(text, maxLen = 100) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean
}

// ── Parse a session JSONL file ────────────────────────────────────────────────
// Returns { sessionId, firstUserMsg, exchanges: [{user, assistant}] }
function parseSessionJsonl(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    const messages = []

    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        // Only main conversation (not sidechain = subagent)
        if (obj.isSidechain) continue
        if (obj.type !== 'user' && obj.type !== 'assistant') continue

        const text = extractText(obj.message?.content)
        if (!text) continue

        messages.push({
          type: obj.type,
          uuid: obj.uuid,
          parentUuid: obj.parentUuid,
          text,
          timestamp: obj.timestamp,
        })
      } catch { /* skip malformed */ }
    }

    // Build exchanges: pair each user message with the next assistant message
    const exchanges = []
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].type === 'user') {
        const assistant = messages.slice(i + 1).find(m => m.type === 'assistant')
        exchanges.push({
          user: messages[i].text,
          assistant: assistant?.text || '',
          timestamp: messages[i].timestamp,
          uuid: messages[i].uuid,
        })
      }
    }

    return { exchanges, firstUserMsg: exchanges[0]?.user || '' }
  } catch {
    return { exchanges: [], firstUserMsg: '' }
  }
}

// ── Parse a subagent JSONL file ───────────────────────────────────────────────
function parseSubagentJsonl(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean)
    let firstMsg = ''
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.type === 'user') {
          firstMsg = extractText(obj.message?.content)
          if (firstMsg) break
        }
      } catch {}
    }
    return { firstMsg }
  } catch {
    return { firstMsg: '' }
  }
}

// ── Read project MEMORY.md if exists ─────────────────────────────────────────
function readProjectMemory(projectDir) {
  const memPath = path.join(projectDir, 'memory', 'MEMORY.md')
  if (!fs.existsSync(memPath)) return null
  try {
    return fs.readFileSync(memPath, 'utf8').slice(0, 2000)
  } catch { return null }
}

// ── Build all nodes + links for a project ─────────────────────────────────────
// Returns { nodes, links }
// Node types: 'session' | 'subagent' | 'memory'
// Link: { source: nodeId, target: nodeId, type: 'spawned'|'memory' }
function buildProjectNodes(projectDir, projectName, userId) {
  const nodes = []
  const links = []

  // Project-level MEMORY.md
  const memContent = readProjectMemory(projectDir)
  const memNodeId = `claude-${projectName}-memory`
  if (memContent) {
    nodes.push({
      id: memNodeId,
      user_id: userId,
      project: projectName,
      nodeType: 'memory',
      summary: `📋 Memória: ${projectName}`,
      content: memContent,
      tags: ['memory'],
      created_at: new Date().toISOString(),
    })
  }

  const entries = fs.readdirSync(projectDir, { withFileTypes: true })

  // Files: {uuid}.jsonl = session files
  const sessionFiles = entries.filter(e => !e.isDirectory() && e.name.endsWith('.jsonl'))
  // Dirs: {uuid} = session folders (contain subagents)
  const sessionDirs  = entries.filter(e => e.isDirectory() && e.name !== 'memory' &&
    /^[0-9a-f-]{36}$/.test(e.name))

  // Process session .jsonl files
  for (const file of sessionFiles) {
    const sessionId = file.name.replace('.jsonl', '')
    const filePath  = path.join(projectDir, file.name)
    const { exchanges, firstUserMsg } = parseSessionJsonl(filePath)

    if (!exchanges.length && !firstUserMsg) continue

    const sessionNodeId = `claude-${projectName}-session-${sessionId}`
    const summary = makeSummary(firstUserMsg || `Sessão ${sessionId.slice(0, 8)}`)

    nodes.push({
      id: sessionNodeId,
      user_id: userId,
      project: projectName,
      nodeType: 'session',
      summary,
      content: JSON.stringify({ sessionId, exchanges: exchanges.slice(0, 5) }),
      tags: ['session'],
      created_at: new Date().toISOString(),
    })

    // Link to memory node
    if (memContent) {
      links.push({ source: memNodeId, target: sessionNodeId, type: 'memory' })
    }
  }

  // Process session dirs (for subagents)
  for (const dir of sessionDirs) {
    const sessionId  = dir.name
    const sessionDir = path.join(projectDir, dir.name)
    const subagentsDir = path.join(sessionDir, 'subagents')
    if (!fs.existsSync(subagentsDir)) continue

    const subFiles = fs.readdirSync(subagentsDir)
    const metaFiles = subFiles.filter(f => f.endsWith('.meta.json'))
    const jsonlFiles = subFiles.filter(f => f.endsWith('.jsonl') && !f.endsWith('.meta.json'))

    // Find or create session node for this dir (if no .jsonl at root)
    const sessionNodeId = `claude-${projectName}-session-${sessionId}`
    const sessionExists = nodes.find(n => n.id === sessionNodeId)

    if (!sessionExists && jsonlFiles.length > 0) {
      // Create a session node summarizing subagents
      nodes.push({
        id: sessionNodeId,
        user_id: userId,
        project: projectName,
        nodeType: 'session',
        summary: `Sessão ${sessionId.slice(0, 8)}… (${jsonlFiles.length} agentes)`,
        content: JSON.stringify({ sessionId }),
        tags: ['session'],
        created_at: new Date().toISOString(),
      })
      if (memContent) {
        links.push({ source: memNodeId, target: sessionNodeId, type: 'memory' })
      }
    }

    // Process each subagent
    for (const metaFile of metaFiles) {
      const agentId = metaFile.replace('.meta.json', '')
      const metaPath = path.join(subagentsDir, metaFile)
      const jsonlPath = path.join(subagentsDir, agentId + '.jsonl')

      let meta = {}
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}

      let firstMsg = ''
      if (fs.existsSync(jsonlPath)) {
        firstMsg = parseSubagentJsonl(jsonlPath).firstMsg
      }

      const agentNodeId = `claude-${projectName}-agent-${agentId}`
      const summary = meta.description
        ? makeSummary(meta.description)
        : (firstMsg ? makeSummary(firstMsg) : `${meta.agentType || 'Agent'} ${agentId.slice(-8)}`)

      nodes.push({
        id: agentNodeId,
        user_id: userId,
        project: projectName,
        nodeType: 'subagent',
        summary,
        content: JSON.stringify({ agentId, agentType: meta.agentType, description: meta.description, firstMsg }),
        tags: ['subagent', meta.agentType || 'agent'].filter(Boolean),
        created_at: new Date().toISOString(),
      })

      // Link: session spawned this agent
      links.push({ source: sessionNodeId, target: agentNodeId, type: 'spawned' })
    }
  }

  return { nodes, links }
}

// ── GET /api/claude/projects ──────────────────────────────────────────────────
router.get('/claude/projects', (req, res) => {
  try {
    if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return res.json({ projects: [] })

    const entries = fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory() && isValidProject(e.name))
      .map(e => {
        const dir = path.join(CLAUDE_PROJECTS_DIR, e.name)
        const name = folderToProjectName(e.name)
        const subEntries = fs.readdirSync(dir, { withFileTypes: true })
        const sessions = subEntries.filter(f =>
          (f.isFile() && f.name.endsWith('.jsonl')) ||
          (f.isDirectory() && /^[0-9a-f-]{36}$/.test(f.name))
        ).length
        const hasMemory = fs.existsSync(path.join(dir, 'memory', 'MEMORY.md'))
        return { name, sessions, hasMemory }
      })
    res.json({ projects })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/claude/nodes?user_id= ────────────────────────────────────────────
router.get('/claude/nodes', (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  res.json({ nodes: dbGetNodes(user_id) })
})

// ── POST /api/claude/sync — sync all projects or a specific one ───────────────
router.post('/claude/sync/:project', (req, res) => {
  const { project } = req.params  // clean project name (e.g. "personal-brain")
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return res.status(404).json({ error: 'Pasta ~/.claude/projects não encontrada' })

  // Find the actual folder by matching clean project name
  const allDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true }).filter(e => e.isDirectory())
  const match = allDirs.find(e => folderToProjectName(e.name).toLowerCase() === project.toLowerCase())
  if (!match) return res.status(404).json({ error: `Projeto "${project}" não encontrado` })

  const projectDir = path.join(CLAUDE_PROJECTS_DIR, match.name)

  dbDeleteNodesByProject(user_id, project)

  const { nodes, links } = buildProjectNodes(projectDir, project, user_id)
  for (const node of nodes) dbInsertNode(node)

  res.json({
    synced: nodes.length,
    nodes,
    links,
    sessions: nodes.filter(n => n.nodeType === 'session').length,
    subagents: nodes.filter(n => n.nodeType === 'subagent').length,
  })
})

// ── POST /api/claude/node — insert single node in real-time ──────────────────
router.post('/claude/node', (req, res) => {
  const { user_id, project, summary, content, tags } = req.body
  if (!user_id || !project || !summary) return res.status(400).json({ error: 'user_id, project, summary required' })

  const node = {
    id: `claude-${project}-chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user_id,
    project,
    nodeType: 'chat',
    summary: summary.slice(0, 120),
    content: content || '',
    tags: tags || [],
    created_at: new Date().toISOString(),
  }
  dbInsertNode(node)
  broadcastNode(node)
  res.json({ node })
})

// ── GET /api/claude/stream?user_id= — SSE real-time ──────────────────────────
router.get('/claude/stream', (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).end()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const heartbeat = setInterval(() => { try { res.write(': ping\n\n') } catch { clearInterval(heartbeat) } }, 25000)
  sseClients.add(res)
  req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res) })
})

export default router

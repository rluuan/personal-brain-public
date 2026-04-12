import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const router = Router()

// ─── SSE clients registry ─────────────────────────────────────────────────────
const sseClients = new Map() // user_id → Set of res objects

function notifyUser(user_id, data) {
  const clients = sseClients.get(user_id)
if (!clients || clients.size === 0) return
  const payload = `data: ${JSON.stringify(data)}\n\n`
  clients.forEach(res => { try { res.write(payload) } catch {} })
}

// ─── Helper: get liveMemoryEnabled for user ───────────────────────────────────
async function isLiveMemoryEnabled(user_id) {
  try {
    if (isSqlite()) {
      const row = getSqlite().prepare('SELECT extra FROM user_settings WHERE user_id=?').get(user_id)
      if (!row) return true // default enabled if no settings yet
      const extra = JSON.parse(row.extra || '{}')
      return extra.liveMemoryEnabled !== false // default true
    } else {
      const r = await getPgPool().query('SELECT extra FROM user_settings WHERE user_id=$1', [user_id])
      if (r.rows.length === 0) return true
      const extra = r.rows[0].extra || {}
      return extra.liveMemoryEnabled !== false
    }
  } catch { return true }
}

// ─── Helper: resolve nickname OR user_id to actual user_id ───────────────────
async function resolveUserId(raw) {
  if (!raw) return null
  try {
    if (isSqlite()) {
      // If it looks like a user_id (starts with 'u-'), use as-is; else look up by nickname
      if (raw.startsWith('u-')) return raw
      const row = getSqlite().prepare('SELECT id FROM users WHERE nickname=?').get(raw)
      return row ? row.id : null
    } else {
      if (raw.startsWith('u-')) return raw
      const r = await getPgPool().query('SELECT id FROM users WHERE nickname=$1', [raw])
      return r.rows.length > 0 ? r.rows[0].id : null
    }
  } catch { return null }
}

// ─── POST /api/memory/capture ─────────────────────────────────────────────────
router.post('/memory/capture', async (req, res) => {
  const { url, title, favicon, timestamp, source = 'chrome-extension', user_id: rawUserId } = req.body
if (!url) return res.status(400).json({ error: 'url required' })
  if (!rawUserId) return res.status(400).json({ error: 'user_id required' })

  const user_id = await resolveUserId(rawUserId)
  if (!user_id) return res.status(404).json({ error: `User not found: ${rawUserId}` })

  const enabled = await isLiveMemoryEnabled(user_id)
  if (!enabled) return res.status(403).json({ error: 'Live Memory disabled' })

  const now = new Date().toISOString()
  const ts = timestamp || now

  try {
    if (isSqlite()) {
      const db = getSqlite()
      const existing = db.prepare('SELECT id FROM live_memories WHERE user_id=? AND url=?').get(user_id, url)
      if (existing) {
  
        return res.json({ status: 'duplicate', id: existing.id, url })
      }
      const id = `lm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      db.prepare(`
        INSERT INTO live_memories(id, user_id, url, title, favicon, source, timestamp, created_at)
        VALUES(?,?,?,?,?,?,?,?)
      `).run(id, user_id, url, title || null, favicon || null, source, ts, now)

      notifyUser(user_id, { type: 'new', id, url, title: title || null, favicon: favicon || null, timestamp: ts })
      return res.json({ status: 'created', id, url, title })
    } else {
      const pool = getPgPool()
      const existing = await pool.query('SELECT id FROM live_memories WHERE user_id=$1 AND url=$2', [user_id, url])
      if (existing.rows.length > 0) {
  
        return res.json({ status: 'duplicate', id: existing.rows[0].id, url })
      }
      const id = `lm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await pool.query(`
        INSERT INTO live_memories(id, user_id, url, title, favicon, source, timestamp, created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      `, [id, user_id, url, title || null, favicon || null, source, ts, now])

      notifyUser(user_id, { type: 'new', id, url, title: title || null, favicon: favicon || null, timestamp: ts })
      return res.json({ status: 'created', id, url, title })
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── GET /api/memory/live/stream (SSE) ───────────────────────────────────────
router.get('/memory/live/stream', (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  if (!sseClients.has(user_id)) sseClients.set(user_id, new Set())
  sseClients.get(user_id).add(res)

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

  req.on('close', () => {
    sseClients.get(user_id)?.delete(res)
  })
})

// ─── GET /api/memory/live ─────────────────────────────────────────────────────
router.get('/memory/live', async (req, res) => {
  const { user_id, page = 1, limit = 25, q } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  const offset = (Number(page) - 1) * Number(limit)

  try {
    if (isSqlite()) {
      const db = getSqlite()
      let sql = 'SELECT * FROM live_memories WHERE user_id=?'
      const params = [user_id]
      if (q) { sql += ' AND (title LIKE ? OR url LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
      params.push(Number(limit), offset)
      const rows = db.prepare(sql).all(...params)
      const countSql = q
        ? 'SELECT COUNT(*) as c FROM live_memories WHERE user_id=? AND (title LIKE ? OR url LIKE ?)'
        : 'SELECT COUNT(*) as c FROM live_memories WHERE user_id=?'
      const countParams = q ? [user_id, `%${q}%`, `%${q}%`] : [user_id]
      const { c: total } = db.prepare(countSql).get(...countParams)
      return res.json({ items: rows, total, page: Number(page), limit: Number(limit) })
    } else {
      const pool = getPgPool()
      let sql = 'SELECT * FROM live_memories WHERE user_id=$1'
      const params = [user_id]
      if (q) { params.push(`%${q}%`, `%${q}%`); sql += ` AND (title ILIKE $${params.length - 1} OR url ILIKE $${params.length})` }
      params.push(Number(limit), offset)
      sql += ` ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`
      const rows = await pool.query(sql, params)
      const countSql = q
        ? 'SELECT COUNT(*) FROM live_memories WHERE user_id=$1 AND (title ILIKE $2 OR url ILIKE $3)'
        : 'SELECT COUNT(*) FROM live_memories WHERE user_id=$1'
      const countParams = q ? [user_id, `%${q}%`, `%${q}%`] : [user_id]
      const countRes = await pool.query(countSql, countParams)
      return res.json({ items: rows.rows, total: Number(countRes.rows[0].count), page: Number(page), limit: Number(limit) })
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── GET /api/memory/live/search ──────────────────────────────────────────────
router.get('/memory/live/search', async (req, res) => {
  const { user_id, q, limit = 10 } = req.query
  if (!user_id || !q) return res.status(400).json({ error: 'user_id and q required' })
  try {
    if (isSqlite()) {
      const rows = getSqlite().prepare(
        'SELECT id, title, url, favicon, timestamp FROM live_memories WHERE user_id=? AND (title LIKE ? OR url LIKE ?) ORDER BY timestamp DESC LIMIT ?'
      ).all(user_id, `%${q}%`, `%${q}%`, Number(limit))
      return res.json(rows)
    } else {
      const r = await getPgPool().query(
        'SELECT id, title, url, favicon, timestamp FROM live_memories WHERE user_id=$1 AND (title ILIKE $2 OR url ILIKE $2) ORDER BY timestamp DESC LIMIT $3',
        [user_id, `%${q}%`, Number(limit)]
      )
      return res.json(r.rows)
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── DELETE /api/memory/live/:id ──────────────────────────────────────────────
router.delete('/memory/live/:id', async (req, res) => {
  const { id } = req.params
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (isSqlite()) {
      getSqlite().prepare('DELETE FROM live_memories WHERE id=? AND user_id=?').run(id, user_id)
    } else {
      await getPgPool().query('DELETE FROM live_memories WHERE id=$1 AND user_id=$2', [id, user_id])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── DELETE /api/memory/live (bulk) ──────────────────────────────────────────
router.delete('/memory/live', async (req, res) => {
  const { user_id, ids } = req.body
  if (!user_id || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'user_id and ids[] required' })
  try {
    if (isSqlite()) {
      const placeholders = ids.map(() => '?').join(',')
      getSqlite().prepare(`DELETE FROM live_memories WHERE user_id=? AND id IN (${placeholders})`).run(user_id, ...ids)
    } else {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(',')
      await getPgPool().query(`DELETE FROM live_memories WHERE user_id=$1 AND id IN (${placeholders})`, [user_id, ...ids])
    }
    res.json({ ok: true, deleted: ids.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router

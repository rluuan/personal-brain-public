import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const router = Router()

router.get('/notes', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (isSqlite()) {
      const rows = getSqlite().prepare('SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC').all(user_id)
      res.json(rows)
    } else {
      const result = await getPgPool().query('SELECT * FROM notes WHERE user_id=$1 ORDER BY updated_at DESC', [user_id])
      res.json(result.rows)
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/notes', async (req, res) => {
  const { id, user_id, title, content, folder_id } = req.body
  try {
    const now = new Date().toISOString()
    if (isSqlite()) {
      const db = getSqlite()
      db.prepare('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, user_id, title, content || `# ${title}\n\n`, folder_id || null, now, now)
      const row = db.prepare('SELECT * FROM notes WHERE id=?').get(id)
      res.json(row)
    } else {
      const pool = getPgPool()
      await pool.query('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)', [id, user_id, title, content || `# ${title}\n\n`, folder_id || null, now])
      const result = await pool.query('SELECT * FROM notes WHERE id=$1', [id])
      res.json(result.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/notes/:id', async (req, res) => {
  const { id } = req.params
  const changes = req.body
  try {
    const now = new Date().toISOString()
    if (isSqlite()) {
      const fields = []
      const values = []
      if ('title'     in changes) { fields.push('title=?');     values.push(changes.title) }
      if ('content'   in changes) { fields.push('content=?');   values.push(changes.content) }
      if ('folder_id' in changes) { fields.push('folder_id=?'); values.push(changes.folder_id) }
      fields.push('updated_at=?')
      values.push(now)
      values.push(id)
      getSqlite().prepare(`UPDATE notes SET ${fields.join(',')} WHERE id=?`).run(...values)
    } else {
      const fields = []
      const values = []
      let i = 1
      if ('title'     in changes) { fields.push(`title=$${i++}`);     values.push(changes.title) }
      if ('content'   in changes) { fields.push(`content=$${i++}`);   values.push(changes.content) }
      if ('folder_id' in changes) { fields.push(`folder_id=$${i++}`); values.push(changes.folder_id) }
      fields.push(`updated_at=$${i++}`)
      values.push(now)
      values.push(id)
      await getPgPool().query(`UPDATE notes SET ${fields.join(',')} WHERE id=$${i}`, values)
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/notes/:id', async (req, res) => {
  try {
    if (isSqlite()) getSqlite().prepare('DELETE FROM notes WHERE id=?').run(req.params.id)
    else await getPgPool().query('DELETE FROM notes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router

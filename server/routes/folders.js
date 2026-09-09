import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const router = Router()

router.get('/folders', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (isSqlite()) {
      const rows = getSqlite().prepare('SELECT * FROM folders WHERE user_id=? ORDER BY name').all(user_id)
      res.json(rows)
    } else {
      const result = await getPgPool().query('SELECT * FROM folders WHERE user_id=$1 ORDER BY name', [user_id])
      res.json(result.rows)
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/folders', async (req, res) => {
  const { id, user_id, name, parent_id, color, icon } = req.body
  try {
    const now = new Date().toISOString()
    if (isSqlite()) {
      const db = getSqlite()
      db.prepare('INSERT INTO folders(id,user_id,name,parent_id,color,icon,created_at) VALUES(?,?,?,?,?,?,?)').run(id, user_id, name, parent_id || null, color || null, icon || null, now)
      res.json(db.prepare('SELECT * FROM folders WHERE id=?').get(id))
    } else {
      const pool = getPgPool()
      await pool.query('INSERT INTO folders(id,user_id,name,parent_id,color,icon,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, user_id, name, parent_id || null, color || null, icon || null, now])
      const result = await pool.query('SELECT * FROM folders WHERE id=$1', [id])
      res.json(result.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/folders/:id', async (req, res) => {
  const changes = req.body
  try {
    if (isSqlite()) {
      const fields = []
      const values = []
      if ('name'  in changes) { fields.push('name=?');  values.push(changes.name) }
      if ('color' in changes) { fields.push('color=?'); values.push(changes.color) }
      if ('icon'  in changes) { fields.push('icon=?');  values.push(changes.icon) }
      if (fields.length === 0) return res.json({ ok: true })
      values.push(req.params.id)
      getSqlite().prepare(`UPDATE folders SET ${fields.join(',')} WHERE id=?`).run(...values)
    } else {
      const fields = []
      const values = []
      let i = 1
      if ('name'  in changes) { fields.push(`name=$${i++}`);  values.push(changes.name) }
      if ('color' in changes) { fields.push(`color=$${i++}`); values.push(changes.color) }
      if ('icon'  in changes) { fields.push(`icon=$${i++}`);  values.push(changes.icon) }
      if (fields.length === 0) return res.json({ ok: true })
      values.push(req.params.id)
      await getPgPool().query(`UPDATE folders SET ${fields.join(',')} WHERE id=$${i}`, values)
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/folders/:id', async (req, res) => {
  try {
    if (isSqlite()) {
      const db = getSqlite()
      db.prepare('UPDATE notes SET folder_id=NULL WHERE folder_id=?').run(req.params.id)
      db.prepare('UPDATE folders SET parent_id=NULL WHERE parent_id=?').run(req.params.id)
      db.prepare('DELETE FROM folders WHERE id=?').run(req.params.id)
    } else {
      const pool = getPgPool()
      await pool.query('UPDATE notes   SET folder_id=NULL WHERE folder_id=$1', [req.params.id])
      await pool.query('UPDATE folders SET parent_id=NULL WHERE parent_id=$1', [req.params.id])
      await pool.query('DELETE FROM folders WHERE id=$1', [req.params.id])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router

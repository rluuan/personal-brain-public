import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const router = Router()

router.get('/settings/:user_id', async (req, res) => {
  const { user_id } = req.params
  try {
    if (isSqlite()) {
      const row = getSqlite().prepare('SELECT * FROM user_settings WHERE user_id=?').get(user_id)
      if (!row) return res.json({ user_id, primary_color: '#cba6f7', secondary_color: '#89b4fa', extra: {} })
      res.json({ ...row, extra: JSON.parse(row.extra || '{}') })
    } else {
      const r = await getPgPool().query('SELECT * FROM user_settings WHERE user_id=$1', [user_id])
      if (r.rows.length === 0) return res.json({ user_id, primary_color: '#cba6f7', secondary_color: '#89b4fa', extra: {} })
      res.json(r.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/settings/:user_id', async (req, res) => {
  const { user_id } = req.params
  const { primary_color = '#cba6f7', secondary_color = '#89b4fa', extra = {} } = req.body
  try {
    if (isSqlite()) {
      getSqlite().prepare(`
        INSERT INTO user_settings(user_id, primary_color, secondary_color, extra)
        VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        primary_color=excluded.primary_color, secondary_color=excluded.secondary_color, extra=excluded.extra
      `).run(user_id, primary_color, secondary_color, JSON.stringify(extra))
    } else {
      await getPgPool().query(`
        INSERT INTO user_settings(user_id, primary_color, secondary_color, extra)
        VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET
        primary_color=$2, secondary_color=$3, extra=$4
      `, [user_id, primary_color, secondary_color, JSON.stringify(extra)])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router

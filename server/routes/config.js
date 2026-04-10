import { Router } from 'express'
import { loadConfig, saveConfig, getConfig } from '../config.js'
import { isSqlite, getSqliteFilePath } from '../db/connection.js'

const router = Router()

router.get('/config', (req, res) => {
  const config = getConfig()
  res.json({ ...config, dbType: isSqlite() ? 'sqlite' : 'postgres', sqliteFile: getSqliteFilePath() })
})

router.post('/config', async (req, res) => {
  try {
    const config = getConfig()
    const newCfg = { ...config, ...req.body }
    saveConfig(newCfg)
    res.json({ ok: true, message: 'Configuração salva. Reinicie o servidor para aplicar as alterações.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

import express from 'express'
import cors from 'cors'
import os from 'os'
import path from 'path'
import { initDb } from './db/schema.js'

// Route modules
import configRoutes  from './routes/config.js'
import userRoutes    from './routes/users.js'
import noteRoutes    from './routes/notes.js'
import folderRoutes  from './routes/folders.js'
import settingsRoutes from './routes/settings.js'
import exportRoutes  from './routes/export.js'
import aiRoutes      from './routes/ai.js'
import ragRoutes     from './routes/rag.js'
import memoryRoutes  from './routes/memory.js'
import claudeRoutes  from './routes/claude.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Mount all route modules under /api
app.use('/api', configRoutes)
app.use('/api', userRoutes)
app.use('/api', noteRoutes)
app.use('/api', folderRoutes)
app.use('/api', settingsRoutes)
app.use('/api', exportRoutes)
app.use('/api', aiRoutes)
app.use('/api', ragRoutes)
app.use('/api', memoryRoutes)
app.use('/api', claudeRoutes)

const PORT = process.env.PORT || 3001

function getLocalIPs() {
  return Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address)
}

// Serve frontend in Electron production build
export async function startServer({ staticDir } = {}) {
  const dir = staticDir || process.env.STATIC_DIR

  if (dir) {
    app.use(express.static(dir))
    app.get(/^(?!\/api).*$/, (req, res) => {
      res.sendFile(path.join(dir, 'index.html'))
    })
  }

  await initDb()
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Brain API → http://localhost:${PORT}`)
    getLocalIPs().forEach(ip => console.log(`                http://${ip}:${PORT}  (rede interna)`))
  })
}

export { app }

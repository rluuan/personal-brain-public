import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..', '..')

const router = Router()

router.post('/export/notes', async (req, res) => {
  const { user_id, notes: clientNotes, folders: clientFolders } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    let notes = clientNotes
    let folders = clientFolders

    if (!notes || !notes.length) {
      if (isSqlite()) {
        notes   = getSqlite().prepare('SELECT * FROM notes WHERE user_id=?').all(user_id)
        folders = getSqlite().prepare('SELECT * FROM folders WHERE user_id=?').all(user_id)
      } else {
        const pool = getPgPool()
        notes   = (await pool.query('SELECT * FROM notes WHERE user_id=$1', [user_id])).rows
        folders = (await pool.query('SELECT * FROM folders WHERE user_id=$1', [user_id])).rows
      }
    }

    const exportDir = path.join(ROOT_DIR, 'memory', user_id)
    fs.mkdirSync(exportDir, { recursive: true })

    const folderMap = {}
    if (folders) for (const f of folders) folderMap[f.id] = f.name

    const allParts = []
    allParts.push(`# Memória Completa\n\n> Gerado em: ${new Date().toLocaleString('pt-BR')}\n> Total de notas: ${notes.length}\n\n---\n`)

    let lastFilePath = ''

    for (const note of notes) {
      const folderName = note.folder_id ? (folderMap[note.folder_id] || 'Sem Pasta') : 'Raiz'
      const noteDir = path.join(exportDir, folderName)
      fs.mkdirSync(noteDir, { recursive: true })

      const safeTitle = (note.title || 'sem-titulo').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
      const content = note.content || `# ${note.title}\n`

      lastFilePath = path.join(noteDir, `${safeTitle}.md`)
      fs.writeFileSync(lastFilePath, content, 'utf8')

      allParts.push(`## ${note.title}\n\n> Pasta: ${folderName} | Atualizado: ${new Date(note.updated_at || note.updatedAt || '').toLocaleDateString('pt-BR')}\n\n${content}\n\n---\n`)
    }

    const completePath = path.join(exportDir, 'memory_complete.md')
    fs.writeFileSync(completePath, allParts.join('\n'), 'utf8')

    res.json({ 
      ok: true, 
      path: exportDir, 
      memoryFile: completePath, 
      count: notes.length,
      filePath: notes.length === 1 ? lastFilePath : completePath
    })
  } catch (err) {
    console.error('[Export Notes]', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/export/db', async (req, res) => {
  try {
    const backupDir = path.join(ROOT_DIR, 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    if (isSqlite()) {
      const backupPath = path.join(backupDir, `brain-backup-${timestamp}.db`)
      getSqlite().backup(backupPath)
      res.json({ ok: true, path: backupPath, type: 'sqlite', filePath: backupPath })
    } else {
      const backupPath = path.join(backupDir, `brain-backup-${timestamp}.json`)
      const tables = ['users', 'folders', 'notes', 'user_settings']
      const data = {}
      const pool = getPgPool()
      for (const t of tables) {
        const r = await pool.query(`SELECT * FROM ${t}`)
        data[t] = r.rows
      }
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8')
      res.json({ ok: true, path: backupPath, type: 'postgres', filePath: backupPath })
    }
  } catch (err) {
    console.error('[Export DB]', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/export/reveal', (req, res) => {
  const { path: targetPath } = req.body
  if (!targetPath) return res.status(400).json({ error: 'path required' })

  // Windows command to open explorer and select the file
  const isWin = process.platform === 'win32'
  const command = isWin 
    ? `explorer.exe /select,"${targetPath}"` 
    : process.platform === 'darwin' 
      ? `open -R "${targetPath}"` 
      : `xdg-open "${path.dirname(targetPath)}"`

  exec(command, (err) => {
    if (err) {
      console.error('[Reveal]', err)
      return res.status(500).json({ error: err.message })
    }
    res.json({ ok: true })
  })
})

export default router

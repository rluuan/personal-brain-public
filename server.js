import express from 'express'
import cors from 'cors'
import pg from 'pg'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import RssParser from 'rss-parser'
import * as cheerio from 'cheerio'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_FILE = path.join(__dirname, 'db-config.json')

// --- Config ------------------------------------------------------------------
const DEFAULT_CONFIG = {
  dbType: 'sqlite',
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB || 'postgres',
  sqliteFile: './brain.db'
}

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
    } catch (e) {
      console.warn('[Config] Erro ao carregar db-config.json, usando padrão.')
    }
  } else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2))
  }
  return DEFAULT_CONFIG
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
}

let config = loadConfig()
const SQLITE_FILE = path.resolve(__dirname, config.sqliteFile || './brain.db')
let USE_SQLITE = config.dbType === 'sqlite'

const { Pool } = pg
const rssParser = new RssParser()
// --- DB Abstraction ----------------------------------------------------------

let pgPool = null
let sqliteDb = null

function getSqlite() {
  if (!sqliteDb) {
    sqliteDb = new Database(SQLITE_FILE)
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('foreign_keys = ON')
  }
  return sqliteDb
}

// Promise-based pg query wrapper
async function pgQuery(sql, params = []) {
  return pgPool.query(sql, params)
}

// Unified DB query: returns { rows: Array }
async function dbq(sql, params = []) {
  if (USE_SQLITE) {
    const sqliteParams = params.map(p => {
      if (p === null || p === undefined) return null
      if (typeof p === 'object') return JSON.stringify(p)
      return p
    })
    const stmt = getSqlite().prepare(sql)
    try {
      const rows = stmt.all(...sqliteParams)
      return { rows }
    } catch {
      stmt.run(...sqliteParams)
      return { rows: [] }
    }
  } else {
    return pgQuery(sql, params)
  }
}

async function dbrun(sql, params = []) {
  if (USE_SQLITE) {
    const sqliteParams = params.map(p => {
      if (p === null || p === undefined) return null
      if (typeof p === 'object') return JSON.stringify(p)
      return p
    })
    getSqlite().prepare(sql).run(...sqliteParams)
  } else {
    await pgPool.query(sql, params)
  }
}

// --- Schema -----------------------------------------------------------------

// pgvectorAvailable is set during schema creation
let pgvectorAvailable = false

async function pgExec(sql, label) {
  try { await pgPool.query(sql) }
  catch (e) { console.warn(`[Schema] ${label}: ${e.message}`) }
}

async function createSchemaPg() {
  // 1. Core tables (must succeed)
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      nickname   TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS folders (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      parent_id  TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      folder_id  TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      primary_color   TEXT NOT NULL DEFAULT '#cba6f7',
      secondary_color TEXT NOT NULL DEFAULT '#89b4fa',
      extra           JSONB NOT NULL DEFAULT '{}'
    );
  `)

  // 2. pgvector extension (optional)
  try {
    await pgPool.query('CREATE EXTENSION IF NOT EXISTS vector;')
    pgvectorAvailable = true
    console.log('[Schema] pgvector OK')
  } catch (e) {
    console.warn('[Schema] pgvector no disponvel  RAG desativado:', e.message)
  }

  // 3. note_chunks table  without vector column first, then add/migrate
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS note_chunks (
      id          TEXT PRIMARY KEY,
      note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      chunk_text  TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      embedding   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_note_chunks_user ON note_chunks(user_id);
    CREATE INDEX IF NOT EXISTS idx_note_chunks_note ON note_chunks(note_id);
  `)

  // 4. Migrate embedding column to vector type if pgvector is available
  if (pgvectorAvailable) {
    try {
      // Check current column type
      const colInfo = await pgPool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name='note_chunks' AND column_name='embedding'
      `)
      const currentType = colInfo.rows[0]?.data_type
      if (currentType && currentType !== 'USER-DEFINED') {
        // Column is TEXT or JSONB  drop and recreate as vector
        await pgPool.query('ALTER TABLE note_chunks DROP COLUMN IF EXISTS embedding;')
        await pgPool.query('ALTER TABLE note_chunks ADD COLUMN embedding vector(768);')
        console.log('[Schema] Coluna embedding migrada para vector(768)')
      }
    } catch (e) {
      console.warn('[Schema] Migrao de embedding:', e.message)
    }

    // 5. HNSW index (optional)
    await pgExec(
      'CREATE INDEX IF NOT EXISTS idx_note_chunks_vector ON note_chunks USING hnsw (embedding vector_cosine_ops);',
      'ndice HNSW'
    )
  }

  console.log(`PostgreSQL schema OK (pgvector: ${pgvectorAvailable ? 'ativo' : 'inativo'})`)
}

function createSchemaSqlite() {
  const db = getSqlite()
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      nickname   TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS folders (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      parent_id  TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      folder_id  TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS note_chunks (
      id          TEXT PRIMARY KEY,
      note_id     TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      chunk_text  TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      embedding   TEXT,
      created_at  TEXT NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id         TEXT PRIMARY KEY,
      primary_color   TEXT NOT NULL DEFAULT '#cba6f7',
      secondary_color TEXT NOT NULL DEFAULT '#89b4fa',
      extra           TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  console.log('SQLite schema OK')
}

async function tryPostgres() {
  if (USE_SQLITE) return false
  try {
    pgPool = new Pool({
      host: config.host,
      port: Number(config.port) || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: 5000,
    })
    // Test basic connectivity BEFORE anything else
    await pgPool.query('SELECT 1')
    // Schema creation failures (e.g. pgvector) are handled internally  never throw here
    await createSchemaPg()
    return true
  } catch (err) {
    // Only fall back to SQLite if we genuinely can't connect
    console.warn(`[DB] PostgreSQL inacessvel (${err.message}). Usando SQLite como fallback.`)
    if (pgPool) { try { await pgPool.end() } catch {} }
    pgPool = null
    USE_SQLITE = true
    config.dbType = 'sqlite'
    saveConfig(config)
    return false
  }
}

async function initDb() {
  const pgOk = await tryPostgres()
  if (!pgOk) {
    createSchemaSqlite()
  }
  console.log(`[DB] Usando: ${USE_SQLITE ? 'SQLite (' + SQLITE_FILE + ')' : 'PostgreSQL'}`)
}

// --- Express -----------------------------------------------------------------

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// --- Config API --------------------------------------------------------------

app.get('/api/config', (req, res) => {
  res.json({ ...config, dbType: USE_SQLITE ? 'sqlite' : 'postgres', sqliteFile: SQLITE_FILE })
})

app.post('/api/config', async (req, res) => {
  try {
    const newCfg = { ...config, ...req.body }
    saveConfig(newCfg)
    config = newCfg
    res.json({ ok: true, message: 'Configurao salva. Reinicie o servidor para aplicar as alteraes.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Users -------------------------------------------------------------------

app.post('/api/users/login', async (req, res) => {
  const { nickname } = req.body
  if (!nickname) return res.status(400).json({ error: 'nickname required' })

  try {
    let existing
    if (USE_SQLITE) {
      existing = getSqlite().prepare('SELECT * FROM users WHERE nickname=?').get(nickname)
    } else {
      const r = await pgPool.query('SELECT * FROM users WHERE nickname=$1', [nickname])
      existing = r.rows[0]
    }
    if (existing) return res.json(existing)

    const id  = `u-${Date.now()}`
    const now = new Date().toISOString()

    if (USE_SQLITE) {
      const db = getSqlite()
      db.prepare('INSERT INTO users(id,nickname,created_at) VALUES(?,?,?)').run(id, nickname, now)
      const folders = [
        { id: `${id}-f1`,   name: 'Guias',    parent_id: null },
        { id: `${id}-f2`,   name: 'Pessoal',  parent_id: null },
        { id: `${id}-f1-1`, name: 'Markdown', parent_id: `${id}-f1` },
      ]
      for (const f of folders) {
        db.prepare('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES(?,?,?,?,?)').run(f.id, id, f.name, f.parent_id, now)
      }
      const notes = getDefaultNotes(id, nickname, now)
      for (const n of notes) {
        db.prepare('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(n.id, id, n.title, n.content, n.folder_id, now, now)
      }
    } else {
      await pgPool.query('INSERT INTO users(id,nickname,created_at) VALUES($1,$2,$3)', [id, nickname, now])
      const folders = [
        { id: `${id}-f1`,   name: 'Guias',    parent_id: null },
        { id: `${id}-f2`,   name: 'Pessoal',  parent_id: null },
        { id: `${id}-f1-1`, name: 'Markdown', parent_id: `${id}-f1` },
      ]
      for (const f of folders) {
        await pgPool.query('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES($1,$2,$3,$4,$5)', [f.id, id, f.name, f.parent_id, now])
      }
      const notes = getDefaultNotes(id, nickname, now)
      for (const n of notes) {
        await pgPool.query('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)', [n.id, id, n.title, n.content, n.folder_id, now])
      }
    }

    res.json({ id, nickname, created_at: now })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

function getDefaultNotes(id, nickname, now) {
  return [
    {
      id: `${id}-n1`, title: 'Bem-vindo', folder_id: null,
      content: `# Bem-vindo, ${nickname}!\n\nEste  o seu espao pessoal de conhecimento.\n\n## Recursos\n\n- **Editor Markdown** com preview ao vivo\n- **[[Wiki Links]]** para conectar notas\n- **#tags** para organizao\n- **Grafo** em 3 painis: editor | preview | grafo\n- **Busca** em tempo real (Ctrl+K)\n- **Backlinks** para ver conexes\n- **Subpastas** para organizao\n\nVeja tambm: [[Guia Rpido]] e [[Guia Markdown]]`,
    },
    {
      id: `${id}-n2`, title: 'Guia Rpido', folder_id: `${id}-f1`,
      content: `# Guia Rpido\n\n## Modos de Visualizao\n\n| Modo | Descrio |\n|------|----------|\n| ?? Edit | Somente editor |\n| ? Split | Editor + Preview |\n| ?? Preview | Somente preview |\n| ?? Grafo | Editor + Preview + Grafo |\n\n## Wiki Links\n\nUse \`[[Ttulo]]\` para linkar notas. Exemplo: [[Bem-vindo]]\n\n## Tags\n\n#guia #atalhos\n\nVeja tambm: [[Guia Markdown]]`,
    },
    {
      id: `${id}-n3`, title: 'Guia Markdown', folder_id: `${id}-f1-1`,
      content: `# Guia Markdown\n\n**Negrito**  *Itlico*  ~~Tachado~~  \`cdigo\`\n\n## Cdigo\n\n\`\`\`javascript\nconst hello = () => console.log("Ol!");\n\`\`\`\n\n## Checklist\n\n- [x] Criar notas\n- [x] Wiki links\n- [ ] Explorar o grafo\n\n#markdown #referncia`,
    },
    {
      id: `${id}-n4`, title: 'Ideias', folder_id: `${id}-f2`,
      content: `# Ideias\n\nEspao livre para capturar pensamentos.\n\n- [[Bem-vindo]]\n- [[Guia Rpido]]\n\n#ideias #criatividade`,
    },
  ]
}

// --- Notes -------------------------------------------------------------------

app.get('/api/notes', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (USE_SQLITE) {
      const rows = getSqlite().prepare('SELECT * FROM notes WHERE user_id=? ORDER BY updated_at DESC').all(user_id)
      res.json(rows)
    } else {
      const result = await pgPool.query('SELECT * FROM notes WHERE user_id=$1 ORDER BY updated_at DESC', [user_id])
      res.json(result.rows)
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/notes', async (req, res) => {
  const { id, user_id, title, content, folder_id } = req.body
  try {
    const now = new Date().toISOString()
    if (USE_SQLITE) {
      const db = getSqlite()
      db.prepare('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, user_id, title, content || `# ${title}\n\n`, folder_id || null, now, now)
      const row = db.prepare('SELECT * FROM notes WHERE id=?').get(id)
      res.json(row)
    } else {
      await pgPool.query('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)', [id, user_id, title, content || `# ${title}\n\n`, folder_id || null, now])
      const result = await pgPool.query('SELECT * FROM notes WHERE id=$1', [id])
      res.json(result.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params
  const changes = req.body
  try {
    const now = new Date().toISOString()
    if (USE_SQLITE) {
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
      await pgPool.query(`UPDATE notes SET ${fields.join(',')} WHERE id=$${i}`, values)
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/notes/:id', async (req, res) => {
  try {
    if (USE_SQLITE) getSqlite().prepare('DELETE FROM notes WHERE id=?').run(req.params.id)
    else await pgPool.query('DELETE FROM notes WHERE id=$1', [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// --- Folders -----------------------------------------------------------------

app.get('/api/folders', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (USE_SQLITE) {
      const rows = getSqlite().prepare('SELECT * FROM folders WHERE user_id=? ORDER BY name').all(user_id)
      res.json(rows)
    } else {
      const result = await pgPool.query('SELECT * FROM folders WHERE user_id=$1 ORDER BY name', [user_id])
      res.json(result.rows)
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/folders', async (req, res) => {
  const { id, user_id, name, parent_id } = req.body
  try {
    const now = new Date().toISOString()
    if (USE_SQLITE) {
      const db = getSqlite()
      db.prepare('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES(?,?,?,?,?)').run(id, user_id, name, parent_id || null, now)
      res.json(db.prepare('SELECT * FROM folders WHERE id=?').get(id))
    } else {
      await pgPool.query('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES($1,$2,$3,$4,$5)', [id, user_id, name, parent_id || null, now])
      const result = await pgPool.query('SELECT * FROM folders WHERE id=$1', [id])
      res.json(result.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/folders/:id', async (req, res) => {
  const { name } = req.body
  try {
    if (USE_SQLITE) getSqlite().prepare('UPDATE folders SET name=? WHERE id=?').run(name, req.params.id)
    else await pgPool.query('UPDATE folders SET name=$1 WHERE id=$2', [name, req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/folders/:id', async (req, res) => {
  try {
    if (USE_SQLITE) {
      const db = getSqlite()
      db.prepare('UPDATE notes SET folder_id=NULL WHERE folder_id=?').run(req.params.id)
      db.prepare('UPDATE folders SET parent_id=NULL WHERE parent_id=?').run(req.params.id)
      db.prepare('DELETE FROM folders WHERE id=?').run(req.params.id)
    } else {
      await pgPool.query('UPDATE notes   SET folder_id=NULL WHERE folder_id=$1', [req.params.id])
      await pgPool.query('UPDATE folders SET parent_id=NULL WHERE parent_id=$1', [req.params.id])
      await pgPool.query('DELETE FROM folders WHERE id=$1', [req.params.id])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// --- Settings ----------------------------------------------------------------

app.get('/api/settings/:user_id', async (req, res) => {
  const { user_id } = req.params
  try {
    if (USE_SQLITE) {
      const row = getSqlite().prepare('SELECT * FROM user_settings WHERE user_id=?').get(user_id)
      if (!row) return res.json({ user_id, primary_color: '#cba6f7', secondary_color: '#89b4fa', extra: {} })
      res.json({ ...row, extra: JSON.parse(row.extra || '{}') })
    } else {
      const r = await pgPool.query('SELECT * FROM user_settings WHERE user_id=$1', [user_id])
      if (r.rows.length === 0) return res.json({ user_id, primary_color: '#cba6f7', secondary_color: '#89b4fa', extra: {} })
      res.json(r.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/settings/:user_id', async (req, res) => {
  const { user_id } = req.params
  const { primary_color = '#cba6f7', secondary_color = '#89b4fa', extra = {} } = req.body
  try {
    if (USE_SQLITE) {
      getSqlite().prepare(`
        INSERT INTO user_settings(user_id, primary_color, secondary_color, extra)
        VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
        primary_color=excluded.primary_color, secondary_color=excluded.secondary_color, extra=excluded.extra
      `).run(user_id, primary_color, secondary_color, JSON.stringify(extra))
    } else {
      await pgPool.query(`
        INSERT INTO user_settings(user_id, primary_color, secondary_color, extra)
        VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET
        primary_color=$2, secondary_color=$3, extra=$4
      `, [user_id, primary_color, secondary_color, JSON.stringify(extra)])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// --- Export: Notes as .md (Memria) -----------------------------------------

app.post('/api/export/notes', async (req, res) => {
  const { user_id, notes: clientNotes, folders: clientFolders } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    // Prefer client-provided decrypted notes; fallback to DB (may be encrypted)
    let notes = clientNotes
    let folders = clientFolders

    if (!notes || !notes.length) {
      if (USE_SQLITE) {
        notes   = getSqlite().prepare('SELECT * FROM notes WHERE user_id=?').all(user_id)
        folders = getSqlite().prepare('SELECT * FROM folders WHERE user_id=?').all(user_id)
      } else {
        notes   = (await pgPool.query('SELECT * FROM notes WHERE user_id=$1', [user_id])).rows
        folders = (await pgPool.query('SELECT * FROM folders WHERE user_id=$1', [user_id])).rows
      }
    }

    const exportDir = path.join(__dirname, 'memory', user_id)
    fs.mkdirSync(exportDir, { recursive: true })

    const folderMap = {}
    if (folders) for (const f of folders) folderMap[f.id] = f.name

    // Build memory_complete.md accumulator
    const allParts = []
    allParts.push(`# Memria Completa\n\n> Gerado em: ${new Date().toLocaleString('pt-BR')}\n> Total de notas: ${notes.length}\n\n---\n`)

    for (const note of notes) {
      const folderName = note.folder_id ? (folderMap[note.folder_id] || 'Sem Pasta') : 'Raiz'
      const noteDir = path.join(exportDir, folderName)
      fs.mkdirSync(noteDir, { recursive: true })

      // Sanitize filename
      const safeTitle = (note.title || 'sem-titulo').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
      const content = note.content || `# ${note.title}\n`

      fs.writeFileSync(path.join(noteDir, `${safeTitle}.md`), content, 'utf8')

      // Add to combined file
      allParts.push(`## ${note.title}\n\n> Pasta: ${folderName} | Atualizado: ${new Date(note.updated_at || note.updatedAt || '').toLocaleDateString('pt-BR')}\n\n${content}\n\n---\n`)
    }

    // Write the complete memory file
    const completePath = path.join(exportDir, 'memory_complete.md')
    fs.writeFileSync(completePath, allParts.join('\n'), 'utf8')

    res.json({ ok: true, path: exportDir, memoryFile: completePath, count: notes.length })
  } catch (err) {
    console.error('[Export Notes]', err)
    res.status(500).json({ error: err.message })
  }
})

// --- Export: DB Backup -------------------------------------------------------

app.post('/api/export/db', async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    if (USE_SQLITE) {
      const backupPath = path.join(backupDir, `brain-backup-${timestamp}.db`)
      getSqlite().backup(backupPath)
      res.json({ ok: true, path: backupPath, type: 'sqlite' })
    } else {
      // Dump all tables as JSON for Postgres (without pg_dump)
      const backupPath = path.join(backupDir, `brain-backup-${timestamp}.json`)
      const tables = ['users', 'folders', 'notes', 'user_settings']
      const data = {}
      for (const t of tables) {
        const r = await pgPool.query(`SELECT * FROM ${t}`)
        data[t] = r.rows
      }
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8')
      res.json({ ok: true, path: backupPath, type: 'postgres' })
    }
  } catch (err) {
    console.error('[Export DB]', err)
    res.status(500).json({ error: err.message })
  }
})

// --- Ollama Status ------------------------------------------------------------

app.get('/api/ollama/status', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    res.json({ ok: true, models: (data.models || []).map(m => m.name) })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

// --- Critique (IA + notas aleatrias) ---------------------------------------

app.post('/api/critique', async (req, res) => {
  const { notes = [], ai_model } = req.body
  if (!notes.length) return res.json({ critique: 'Adicione algumas notas para eu analisar! ??' })

  const pool = notes.filter(n => (n.content || '').length > 30)
  const sample = pool.sort(() => Math.random() - 0.5).slice(0, 3)
  if (!sample.length) return res.json({ critique: 'Escreva mais nas suas notas para eu analisar! ??' })

  const context = sample.map(n =>
    `Nota: "${n.title}"\n${(n.content || '').slice(0, 400).replace(/#+\s/g, '').trim()}`
  ).join('\n\n---\n\n')

  const prompt = `Analise as seguintes notas do usurio e d UMA crtica construtiva em portugus:\n\n${context}\n\nA crtica deve:\n- Ser direta e til (mximo 3 frases)\n- Apontar algo concreto que pode melhorar (estrutura, profundidade, clareza, conexes)\n- Tom encorajador, no punitivo\n- Terminar com uma sugesto de ao concreta\n\nRetorne APENAS a crtica, sem introdues ou ttulos.`

  try {
    let critique = ''
    for await (const token of ollamaStream(
      prompt,
      'Voc  um mentor de produtividade intelectual. D feedbacks curtos, objetivos e construtivos sobre notas de conhecimento pessoal.',
      ai_model
    )) {
      critique += token
    }
    res.json({ ok: true, critique: critique.trim(), sources: sample.map(n => n.title) })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, critique: 'Ollama no respondeu ??' })
  }
})

// --- Scrape ------------------------------------------------------------------

app.post('/api/scrape', async (req, res) => {
  const { url, useAI = false, ai_model } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonalBrain/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .ad, .advertisement, iframe, noscript').remove()

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Pgina Importada'

    // Extract main content
    const mainContent = $('article, main, [role="main"], .post-content, .entry-content, .article-body').first()
    const contentEl = mainContent.length ? mainContent : $('body')

    // Convert to markdown-ish text
    let markdown = `# ${title}\n\n> Fonte: [${url}](${url})\n\n`

    contentEl.find('h1,h2,h3,h4,p,ul,ol,li,blockquote,pre,code,img').each((_, el) => {
      const tag = el.tagName.toLowerCase()
      const text = $(el).text().trim()
      if (!text && tag !== 'img') return
      if (tag === 'h1') markdown += `# ${text}\n\n`
      else if (tag === 'h2') markdown += `## ${text}\n\n`
      else if (tag === 'h3') markdown += `### ${text}\n\n`
      else if (tag === 'h4') markdown += `#### ${text}\n\n`
      else if (tag === 'p') markdown += `${text}\n\n`
      else if (tag === 'li') markdown += `- ${text}\n`
      else if (tag === 'blockquote') markdown += `> ${text}\n\n`
      else if (tag === 'code') markdown += `\`${text}\``
      else if (tag === 'pre') markdown += `\`\`\`\n${text}\n\`\`\`\n\n`
      else if (tag === 'img') {
        const src = $(el).attr('src') || ''
        const alt = $(el).attr('alt') || ''
        if (src) markdown += `![${alt}](${src})\n\n`
      }
    })

    if (useAI) {
      // SSE streaming response for AI formatting
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
      send({ type: 'start' })
      try {
        let formatted = ''
        for await (const token of ollamaStream(`Formate o seguinte texto como Markdown limpo e bem estruturado:\n\n${markdown}`, MARKDOWN_SYSTEM, ai_model)) {
          formatted += token
          send({ type: 'token', token })
        }
        send({ type: 'done', content: formatted, title })
      } catch (e) {
        send({ type: 'error', message: e.message })
      }
      res.end()
    } else {
      res.json({ ok: true, title, content: markdown })
    }
  } catch (err) {
    console.error('[Scrape]', err)
    res.status(500).json({ error: err.message })
  }
})

// --- Embeddings / RAG --------------------------------------------------------

const OLLAMA_URL           = process.env.OLLAMA_URL || 'http://localhost:11434'
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b'
const DEFAULT_EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

async function getEmbedding(text, model = DEFAULT_EMBED_MODEL) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  })
  if (!res.ok) throw new Error(`Embedding error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return data.embedding
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i] }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

app.get('/api/sync/status', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (USE_SQLITE) {
      const total  = getSqlite().prepare('SELECT COUNT(*) as c FROM notes WHERE user_id=?').get(user_id).c
      const synced = getSqlite().prepare('SELECT COUNT(DISTINCT note_id) as c FROM note_chunks WHERE user_id=?').get(user_id).c
      res.json({ total, synced, pending: Math.max(0, total - synced) })
    } else {
      const total   = await pgPool.query('SELECT COUNT(*) FROM notes WHERE user_id=$1', [user_id])
      const synced  = await pgPool.query('SELECT COUNT(DISTINCT note_id) FROM note_chunks WHERE user_id=$1', [user_id])
      const t = Number(total.rows[0].count), s = Number(synced.rows[0].count)
      res.json({ total: t, synced: s, pending: Math.max(0, t - s) })
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/sync/embeddings', async (req, res) => {
  const { user_id, notes: clientNotes, embed_model } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id required' })

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  if (req.socket) req.socket.setNoDelay(true)

  const send = (obj) => { res.write(`data: ${JSON.stringify(obj)}\n\n`); if (typeof res.flush === 'function') res.flush() }

  try {
    let syncedIds
    if (USE_SQLITE) {
      const rows = getSqlite().prepare('SELECT DISTINCT note_id FROM note_chunks WHERE user_id=?').all(user_id)
      syncedIds = new Set(rows.map(r => r.note_id))
    } else {
      const r = await pgPool.query('SELECT DISTINCT note_id FROM note_chunks WHERE user_id=$1', [user_id])
      syncedIds = new Set(r.rows.map(r => r.note_id))
    }

    let allNotes
    if (Array.isArray(clientNotes) && clientNotes.length > 0) {
      allNotes = clientNotes
    } else if (USE_SQLITE) {
      allNotes = getSqlite().prepare('SELECT id, title, content FROM notes WHERE user_id=?').all(user_id)
    } else {
      allNotes = (await pgPool.query('SELECT id, title, content FROM notes WHERE user_id=$1', [user_id])).rows
    }

    const pending = allNotes.filter(n => !syncedIds.has(n.id))
    send({ type: 'start', total: pending.length })

    for (let i = 0; i < pending.length; i++) {
      const note = pending[i]
      const text = `${note.title}\n\n${note.content}`
      const chunks = splitChunks(text, 500)
      send({ type: 'progress', done: i, total: pending.length, note_title: note.title })

      if (USE_SQLITE) {
        getSqlite().prepare('DELETE FROM note_chunks WHERE note_id=?').run(note.id)
        for (let j = 0; j < chunks.length; j++) {
          const embedding = await getEmbedding(chunks[j], embed_model)
          getSqlite().prepare('INSERT INTO note_chunks(id,note_id,user_id,chunk_text,chunk_index,embedding,created_at) VALUES(?,?,?,?,?,?,?)').run(
            `${note.id}-c${j}`, note.id, user_id, chunks[j], j, JSON.stringify(embedding), new Date().toISOString()
          )
        }
      } else {
        await pgPool.query('DELETE FROM note_chunks WHERE note_id=$1', [note.id])
        for (let j = 0; j < chunks.length; j++) {
          const embedding = await getEmbedding(chunks[j], embed_model)
          await pgPool.query('INSERT INTO note_chunks(id,note_id,user_id,chunk_text,chunk_index,embedding) VALUES($1,$2,$3,$4,$5,$6)', [`${note.id}-c${j}`, note.id, user_id, chunks[j], j, `[${embedding.join(',')}]`])
        }
      }
      send({ type: 'progress', done: i + 1, total: pending.length, note_title: note.title })
    }
    send({ type: 'done', total: pending.length })
  } catch (err) {
    console.error('[Sync] Erro:', err)
    send({ type: 'error', message: err.message })
  }
  res.end()
})

app.post('/api/chat', async (req, res) => {
  const { message, user_id, rag = false, history = [], ai_model, embed_model } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  if (req.socket) req.socket.setNoDelay(true)

  const send = (obj) => { res.write(`data: ${JSON.stringify(obj)}\n\n`); if (typeof res.flush === 'function') res.flush() }

  try {
    let contextBlock = ''
    if (rag && user_id) {
      send({ type: 'searching' })
      const queryEmb = await getEmbedding(message, embed_model)

      if (USE_SQLITE) {
        const chunks = getSqlite().prepare('SELECT chunk_text, embedding FROM note_chunks WHERE user_id=?').all(user_id)
        const scored = chunks.map(c => ({
          chunk_text: c.chunk_text,
          score: cosineSimilarity(queryEmb, JSON.parse(c.embedding || '[]'))
        })).filter(c => c.score > 0.3).sort((a, b) => b.score - a.score).slice(0, 5)
        if (scored.length > 0) {
          contextBlock = `\n\nTrechos relevantes:\n\n${scored.map((s, i) => `[${i+1}] ${s.chunk_text}`).join('\n\n---\n\n')}`
          send({ type: 'thought', text: contextBlock })
        }
      } else {
        const chunksRes = await pgPool.query('SELECT chunk_text, (1 - (embedding <=> $2)) as score FROM note_chunks WHERE user_id=$1 ORDER BY embedding <=> $2 LIMIT 5', [user_id, `[${queryEmb.join(',')}]`])
        const scored = chunksRes.rows.filter(r => r.score > 0.3)
        if (scored.length > 0) {
          contextBlock = `\n\nTrechos relevantes:\n\n${scored.map((s, i) => `[${i+1}] ${s.chunk_text}`).join('\n\n---\n\n')}`
          send({ type: 'thought', text: contextBlock })
        }
      }
    }

    const CHAT_SYSTEM = `Voc  um assistente de conhecimento pessoal. Responda sempre em portugus, de forma concisa e til.${contextBlock ? '\n\nUse os trechos de notas abaixo como contexto para responder.' + contextBlock : ''}`
    const historyText = history.map(h => `${h.role === 'user' ? 'Usurio' : 'Assistente'}: ${h.content}`).join('\n')
    const prompt = historyText ? `${historyText}\nUsurio: ${message}\nAssistente:` : `Usurio: ${message}\nAssistente:`

    send({ type: 'start' })
    for await (const token of ollamaStream(prompt, CHAT_SYSTEM, ai_model)) send({ type: 'token', token })
    send({ type: 'done' })
  } catch (err) {
    console.error('[Chat] Erro:', err)
    send({ type: 'error', message: err.message })
  }
  res.end()
})

// --- AI Format ---------------------------------------------------------------

const MARKDOWN_SYSTEM = `Voc  um formatador de texto Markdown. Regras absolutas  sem excees:

REGRA 1: RETORNE SOMENTE o texto formatado. ZERO frases introdutrias. ZERO explicaes.
REGRA 2: Preserve TODO o contedo original  apenas melhore a formatao.
REGRA 3: Preserve o idioma original do texto. NO traduza.
REGRA 4: Sua resposta comea NA PRIMEIRA PALAVRA do texto formatado.

Use: # Ttulos, ## Sees, **negrito**, *itlico*, \`cdigo\`, listas com -, tabelas, blocos de cdigo com linguagem.`

async function* ollamaStream(prompt, system = MARKDOWN_SYSTEM, model = DEFAULT_OLLAMA_MODEL) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, system, stream: true }),
  })
  if (!res.ok) throw new Error(`Ollama: ${res.status} ${res.statusText}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try { const data = JSON.parse(line); if (data.response) yield data.response; if (data.done) return } catch {}
    }
  }
}

async function ollamaGenerate(prompt, model) {
  let result = ''
  for await (const token of ollamaStream(prompt, MARKDOWN_SYSTEM, model)) result += token
  return result.trim()
}

function splitChunks(content, maxChars = 700) {
  const paras = content.split(/\n{2,}/)
  const chunks = []
  let cur = ''
  for (const p of paras) {
    const next = cur ? cur + '\n\n' + p : p
    if (cur && next.length > maxChars) { chunks.push(cur); cur = p } else cur = next
  }
  if (cur) chunks.push(cur)
  return chunks.length ? chunks : [content]
}

app.post('/api/ai/format', async (req, res) => {
  const { content, title, notes = [], translate = false, ai_model } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  if (req.socket) req.socket.setNoDelay(true)

  const send = (obj) => { res.write(`data: ${JSON.stringify(obj)}\n\n`); if (typeof res.flush === 'function') res.flush() }

  try {
    const chunks = splitChunks(content)
    const results = [...chunks]
    send({ type: 'start', total: chunks.length })
    for (let i = 0; i < chunks.length; i++) {
      send({ type: 'progress', chunk: i + 1, total: chunks.length })
      results[i] = ''
      let lastFlush = Date.now()
      const translateInstruction = translate ? 'Se o texto estiver em outro idioma, traduza para portugus. ' : ''
      for await (const token of ollamaStream(`${translateInstruction}Formate APENAS este trecho em Markdown:\n\n${chunks[i]}`, MARKDOWN_SYSTEM, ai_model)) {
        results[i] += token
        if (Date.now() - lastFlush >= 300) { send({ type: 'partial', content: results.join('\n\n') }); lastFlush = Date.now() }
      }
      results[i] = results[i].trim()
      send({ type: 'partial', content: results.join('\n\n'), chunk: i + 1, total: chunks.length })
    }
    let final = results.join('\n\n')
    if (notes.length > 0) {
      send({ type: 'linking' })
      const titles = notes.map(n => n.title).join('\n- ')
      final = await ollamaGenerate(`Adicione wikilinks [[Ttulo]] onde houver relao com as notas listadas. Retorne SOMENTE o texto modificado.\n\nNotas:\n- ${titles}\n\nTexto:\n\n${final}`, ai_model)
      send({ type: 'partial', content: final })
    }
    send({ type: 'done', content: final })
  } catch (err) {
    console.error('[AI] Erro:', err)
    send({ type: 'error', message: err.message })
  }
  res.end()
})

// --- Start -------------------------------------------------------------------

const PORT = process.env.PORT || 3001

function getLocalIPs() {
  return Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address)
}

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Brain API ? http://localhost:${PORT}`)
    getLocalIPs().forEach(ip => console.log(`                http://${ip}:${PORT}  (rede interna)`))
  })
}).catch((err) => {
  console.error('Erro fatal ao iniciar:', err.message)
  process.exit(1)
})

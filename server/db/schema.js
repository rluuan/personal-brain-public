import { getSqlite, getPgPool, tryPostgres, isSqlite, setPgvectorAvailable } from './connection.js'

async function pgExec(sql, label) {
  try { await getPgPool().query(sql) }
  catch (e) { console.warn(`[Schema] ${label}: ${e.message}`) }
}

export async function createSchemaPg() {
  const pool = getPgPool()

  // 0. Live memories table
  await pgExec(`
    CREATE TABLE IF NOT EXISTS live_memories (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url        TEXT NOT NULL,
      title      TEXT,
      favicon    TEXT,
      source     TEXT NOT NULL DEFAULT 'chrome-extension',
      timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, url)
    );
    CREATE INDEX IF NOT EXISTS idx_live_memories_user ON live_memories(user_id);
  `, 'live_memories table')

  // 1. Core tables
  await pool.query(`
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
  let pgvectorAvailable = false
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;')
    pgvectorAvailable = true
    setPgvectorAvailable(true)
    console.log('[Schema] pgvector OK')
  } catch (e) {
    console.warn('[Schema] pgvector não disponível — RAG desativado:', e.message)
  }

  // 3. note_chunks table
  await pool.query(`
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
      const colInfo = await pool.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name='note_chunks' AND column_name='embedding'
      `)
      const currentType = colInfo.rows[0]?.data_type
      if (currentType && currentType !== 'USER-DEFINED') {
        await pool.query('ALTER TABLE note_chunks DROP COLUMN IF EXISTS embedding;')
        await pool.query('ALTER TABLE note_chunks ADD COLUMN embedding vector(768);')
        console.log('[Schema] Coluna embedding migrada para vector(768)')
      }
    } catch (e) {
      console.warn('[Schema] Migração de embedding:', e.message)
    }

    // 5. HNSW index
    await pgExec(
      'CREATE INDEX IF NOT EXISTS idx_note_chunks_vector ON note_chunks USING hnsw (embedding vector_cosine_ops);',
      'Índice HNSW'
    )
  }

  await pgExec(`
    CREATE TABLE IF NOT EXISTS claude_memory_nodes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project    TEXT NOT NULL,
      summary    TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      tags       JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_claude_memory_user    ON claude_memory_nodes(user_id);
    CREATE INDEX IF NOT EXISTS idx_claude_memory_project ON claude_memory_nodes(project);
  `, 'claude_memory_nodes table')

  console.log(`PostgreSQL schema OK (pgvector: ${pgvectorAvailable ? 'ativo' : 'inativo'})`)
}

export function createSchemaSqlite() {
  const db = getSqlite()
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_memories (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      url        TEXT NOT NULL,
      title      TEXT,
      favicon    TEXT,
      source     TEXT NOT NULL DEFAULT 'chrome-extension',
      timestamp  TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, url)
    );
    CREATE INDEX IF NOT EXISTS idx_live_memories_user ON live_memories(user_id);
  `)
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS claude_memory_nodes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      project    TEXT NOT NULL,
      summary    TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '',
      tags       TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_claude_memory_user    ON claude_memory_nodes(user_id);
    CREATE INDEX IF NOT EXISTS idx_claude_memory_project ON claude_memory_nodes(project);
  `)
  console.log('SQLite schema OK')
}

export async function initDb() {
  const pgOk = await tryPostgres()
  if (pgOk) {
    await createSchemaPg()
  } else {
    createSchemaSqlite()
  }
  const sqliteFile = isSqlite() ? 'SQLite' : 'PostgreSQL'
  console.log(`[DB] Usando: ${sqliteFile}`)
}

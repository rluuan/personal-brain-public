import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import Database from 'better-sqlite3'
import { loadConfig, saveConfig, setConfig } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { Pool } = pg

let pgPool = null
let sqliteDb = null
let USE_SQLITE = true
let pgvectorAvailable = false

export function isSqlite() { return USE_SQLITE }
export function isPgvectorAvailable() { return pgvectorAvailable }
export function setPgvectorAvailable(val) { pgvectorAvailable = val }

export function getSqlite() {
  if (!sqliteDb) {
    const config = loadConfig()
    const SQLITE_FILE = path.resolve(__dirname, '..', '..', config.sqliteFile || './brain.db')
    sqliteDb = new Database(SQLITE_FILE)
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('foreign_keys = ON')
  }
  return sqliteDb
}

export function getPgPool() {
  return pgPool
}

export function getSqliteFilePath() {
  const config = loadConfig()
  return path.resolve(__dirname, '..', '..', config.sqliteFile || './brain.db')
}

export async function tryPostgres() {
  const config = loadConfig()
  USE_SQLITE = config.dbType === 'sqlite'
  if (USE_SQLITE) return false
  try {
    pgPool = new Pool({
      host: config.host,
      port: Number(config.port) || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionTimeoutMillis: 5000,
      min: 1,
    })
    await pgPool.query('SELECT 1')
    return true
  } catch (err) {
    console.warn(`[DB] PostgreSQL inacessível (${err.message}). Usando SQLite como fallback.`)
    if (pgPool) { try { await pgPool.end() } catch {} }
    pgPool = null
    USE_SQLITE = true
    const newConfig = { ...config, dbType: 'sqlite' }
    setConfig(newConfig)
    saveConfig(newConfig)
    return false
  }
}

export function setUseSqlite(val) { USE_SQLITE = val }

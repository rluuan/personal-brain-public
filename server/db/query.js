import { isSqlite, getSqlite, getPgPool } from './connection.js'

/**
 * Unified DB query: returns { rows: Array }
 */
export async function dbq(sql, params = []) {
  if (isSqlite()) {
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
    return getPgPool().query(sql, params)
  }
}

/**
 * Unified DB run (INSERT/UPDATE/DELETE without returning rows)
 */
export async function dbrun(sql, params = []) {
  if (isSqlite()) {
    const sqliteParams = params.map(p => {
      if (p === null || p === undefined) return null
      if (typeof p === 'object') return JSON.stringify(p)
      return p
    })
    getSqlite().prepare(sql).run(...sqliteParams)
  } else {
    await getPgPool().query(sql, params)
  }
}

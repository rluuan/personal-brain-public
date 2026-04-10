import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'
import { getEmbedding, cosineSimilarity, ollamaStream, splitChunks } from '../services/ollama.js'

const router = Router()

router.get('/sync/status', async (req, res) => {
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'user_id required' })
  try {
    if (isSqlite()) {
      const total  = getSqlite().prepare('SELECT COUNT(*) as c FROM notes WHERE user_id=?').get(user_id).c
      const synced = getSqlite().prepare('SELECT COUNT(DISTINCT note_id) as c FROM note_chunks WHERE user_id=?').get(user_id).c
      res.json({ total, synced, pending: Math.max(0, total - synced) })
    } else {
      const pool = getPgPool()
      const total   = await pool.query('SELECT COUNT(*) FROM notes WHERE user_id=$1', [user_id])
      const synced  = await pool.query('SELECT COUNT(DISTINCT note_id) FROM note_chunks WHERE user_id=$1', [user_id])
      const t = Number(total.rows[0].count), s = Number(synced.rows[0].count)
      res.json({ total: t, synced: s, pending: Math.max(0, t - s) })
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/sync/embeddings', async (req, res) => {
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
    if (isSqlite()) {
      const rows = getSqlite().prepare('SELECT DISTINCT note_id FROM note_chunks WHERE user_id=?').all(user_id)
      syncedIds = new Set(rows.map(r => r.note_id))
    } else {
      const r = await getPgPool().query('SELECT DISTINCT note_id FROM note_chunks WHERE user_id=$1', [user_id])
      syncedIds = new Set(r.rows.map(r => r.note_id))
    }

    let allNotes
    if (Array.isArray(clientNotes) && clientNotes.length > 0) {
      allNotes = clientNotes
    } else if (isSqlite()) {
      allNotes = getSqlite().prepare('SELECT id, title, content FROM notes WHERE user_id=?').all(user_id)
    } else {
      allNotes = (await getPgPool().query('SELECT id, title, content FROM notes WHERE user_id=$1', [user_id])).rows
    }

    const pending = allNotes.filter(n => !syncedIds.has(n.id))
    send({ type: 'start', total: pending.length })

    for (let i = 0; i < pending.length; i++) {
      const note = pending[i]
      const text = `${note.title}\n\n${note.content}`
      const chunks = splitChunks(text, 500)
      send({ type: 'progress', done: i, total: pending.length, note_title: note.title })

      if (isSqlite()) {
        getSqlite().prepare('DELETE FROM note_chunks WHERE note_id=?').run(note.id)
        for (let j = 0; j < chunks.length; j++) {
          const embedding = await getEmbedding(chunks[j], embed_model)
          getSqlite().prepare('INSERT INTO note_chunks(id,note_id,user_id,chunk_text,chunk_index,embedding,created_at) VALUES(?,?,?,?,?,?,?)').run(
            `${note.id}-c${j}`, note.id, user_id, chunks[j], j, JSON.stringify(embedding), new Date().toISOString()
          )
        }
      } else {
        const pool = getPgPool()
        await pool.query('DELETE FROM note_chunks WHERE note_id=$1', [note.id])
        for (let j = 0; j < chunks.length; j++) {
          const embedding = await getEmbedding(chunks[j], embed_model)
          await pool.query('INSERT INTO note_chunks(id,note_id,user_id,chunk_text,chunk_index,embedding) VALUES($1,$2,$3,$4,$5,$6)', [`${note.id}-c${j}`, note.id, user_id, chunks[j], j, `[${embedding.join(',')}]`])
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

router.post('/chat', async (req, res) => {
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

      if (isSqlite()) {
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
        const chunksRes = await getPgPool().query('SELECT chunk_text, (1 - (embedding <=> $2)) as score FROM note_chunks WHERE user_id=$1 ORDER BY embedding <=> $2 LIMIT 5', [user_id, `[${queryEmb.join(',')}]`])
        const scored = chunksRes.rows.filter(r => r.score > 0.3)
        if (scored.length > 0) {
          contextBlock = `\n\nTrechos relevantes:\n\n${scored.map((s, i) => `[${i+1}] ${s.chunk_text}`).join('\n\n---\n\n')}`
          send({ type: 'thought', text: contextBlock })
        }
      }
    }

    const CHAT_SYSTEM = `Você é um assistente de conhecimento pessoal. Responda sempre em português, de forma concisa e útil.${contextBlock ? '\n\nUse os trechos de notas abaixo como contexto para responder.' + contextBlock : ''}`
    const historyText = history.map(h => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.content}`).join('\n')
    const prompt = historyText ? `${historyText}\nUsuário: ${message}\nAssistente:` : `Usuário: ${message}\nAssistente:`

    send({ type: 'start' })
    for await (const token of ollamaStream(prompt, CHAT_SYSTEM, ai_model)) send({ type: 'token', token })
    send({ type: 'done' })
  } catch (err) {
    console.error('[Chat] Erro:', err)
    send({ type: 'error', message: err.message })
  }
  res.end()
})

export default router

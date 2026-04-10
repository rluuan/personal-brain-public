import { Router } from 'express'
import * as cheerio from 'cheerio'
import { ollamaStream, MARKDOWN_SYSTEM, OLLAMA_URL } from '../services/ollama.js'

const router = Router()

router.get('/ollama/status', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    res.json({ ok: true, models: (data.models || []).map(m => m.name) })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

router.post('/critique', async (req, res) => {
  const { notes = [], ai_model } = req.body
  if (!notes.length) return res.json({ critique: 'Adicione algumas notas para eu analisar!' })

  const pool = notes.filter(n => (n.content || '').length > 30)
  const sample = pool.sort(() => Math.random() - 0.5).slice(0, 3)
  if (!sample.length) return res.json({ critique: 'Escreva mais nas suas notas para eu analisar!' })

  const context = sample.map(n =>
    `Nota: "${n.title}"\n${(n.content || '').slice(0, 400).replace(/#+\s/g, '').trim()}`
  ).join('\n\n---\n\n')

  const prompt = `Analise as seguintes notas do usuário e dê UMA crítica construtiva em português:\n\n${context}\n\nA crítica deve:\n- Ser direta e útil (máximo 3 frases)\n- Apontar algo concreto que pode melhorar (estrutura, profundidade, clareza, conexões)\n- Tom encorajador, não punitivo\n- Terminar com uma sugestão de ação concreta\n\nRetorne APENAS a crítica, sem introduções ou títulos.`

  try {
    let critique = ''
    for await (const token of ollamaStream(
      prompt,
      'Você é um mentor de produtividade intelectual. Dê feedbacks curtos, objetivos e construtivos sobre notas de conhecimento pessoal.',
      ai_model
    )) {
      critique += token
    }
    res.json({ ok: true, critique: critique.trim(), sources: sample.map(n => n.title) })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, critique: 'Ollama não respondeu' })
  }
})

router.post('/scrape', async (req, res) => {
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

    $('script, style, nav, footer, header, aside, .ad, .advertisement, iframe, noscript').remove()

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Página Importada'

    const mainContent = $('article, main, [role="main"], .post-content, .entry-content, .article-body').first()
    const contentEl = mainContent.length ? mainContent : $('body')

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

router.post('/ai/format', async (req, res) => {
  const { content, title, notes = [], translate = false, ai_model } = req.body
  if (!content) return res.status(400).json({ error: 'content required' })

  const { splitChunks, ollamaGenerate } = await import('../services/ollama.js')

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
      const translateInstruction = translate ? 'Se o texto estiver em outro idioma, traduza para português. ' : ''
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
      final = await ollamaGenerate(`Adicione wikilinks [[Título]] onde houver relação com as notas listadas. Retorne SOMENTE o texto modificado.\n\nNotas:\n- ${titles}\n\nTexto:\n\n${final}`, ai_model)
      send({ type: 'partial', content: final })
    }
    send({ type: 'done', content: final })
  } catch (err) {
    console.error('[AI] Erro:', err)
    send({ type: 'error', message: err.message })
  }
  res.end()
})

export default router

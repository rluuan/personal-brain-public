import { Router } from 'express'

const OLLAMA_URL           = process.env.OLLAMA_URL || 'http://localhost:11434'
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b'
const DEFAULT_EMBED_MODEL  = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'

const MARKDOWN_SYSTEM = `Você é um formatador de texto Markdown. Regras absolutas — sem exceções:

REGRA 1: RETORNE SOMENTE o texto formatado. ZERO frases introdutórias. ZERO explicações.
REGRA 2: Preserve TODO o conteúdo original — apenas melhore a formatação.
REGRA 3: Preserve o idioma original do texto. NÃO traduza.
REGRA 4: Sua resposta começa NA PRIMEIRA PALAVRA do texto formatado.

Use: # Títulos, ## Seções, **negrito**, *itálico*, \`código\`, listas com -, tabelas, blocos de código com linguagem.`

export async function getEmbedding(text, model = DEFAULT_EMBED_MODEL) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
  })
  if (!res.ok) throw new Error(`Embedding error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return data.embedding
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i] }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

export async function* ollamaStream(prompt, system = MARKDOWN_SYSTEM, model = DEFAULT_OLLAMA_MODEL) {
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

export async function ollamaGenerate(prompt, model) {
  let result = ''
  for await (const token of ollamaStream(prompt, MARKDOWN_SYSTEM, model)) result += token
  return result.trim()
}

export function splitChunks(content, maxChars = 700) {
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

export { OLLAMA_URL, DEFAULT_OLLAMA_MODEL, DEFAULT_EMBED_MODEL, MARKDOWN_SYSTEM }

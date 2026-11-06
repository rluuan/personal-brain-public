export function getLinks(content) {
  const matches = [...(content || '').matchAll(/\[\[([^\]]+)\]\]/g)]
  return matches.map((m) => m[1])
}

export function extractTags(content) {
  const matches = [...(content || '').matchAll(/#(\w+)/g)]
  return [...new Set(matches.map((m) => m[1]))]
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

export function getWikiQuery(value, cursor) {
  const before = value.slice(0, cursor)
  const open = before.lastIndexOf('[[')
  if (open === -1) return null
  const between = before.slice(open + 2)
  if (between.includes(']]') || between.includes('\n')) return null
  return between
}

// Detecta "/palavra" digitado no início da linha ou depois de um espaço (estilo Notion)
export function getSlashQuery(value, cursor) {
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1
  const lineBeforeCursor = value.slice(lineStart, cursor)
  const match = lineBeforeCursor.match(/(?:^|\s)\/(\w*)$/)
  return match ? match[1] : null
}

const TABLE_DELIM_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/

function cellIndexAtCursor(lineText, colInLine) {
  const pipes = []
  for (let i = 0; i < lineText.length; i++) if (lineText[i] === '|') pipes.push(i)
  if (pipes.length === 0) return 0
  const startsWithPipe = lineText.slice(0, pipes[0]).trim() === ''
  const boundaries = startsWithPipe ? pipes : [-1, ...pipes]
  let idx = 0
  for (let i = 0; i < boundaries.length - 1; i++) {
    idx = i
    if (colInLine <= boundaries[i + 1]) break
  }
  return idx
}

// Detecta se o cursor está dentro de um bloco de tabela markdown (GFM).
// Retorna null se não estiver, ou { tableFrom, tableTo, text, rowIndex, colIndex } em offsets absolutos do doc.
export function getTableContext(doc, cursor) {
  const lines = doc.split('\n')
  let pos = 0
  let curLineIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length
    if (cursor <= pos + len) { curLineIdx = i; break }
    pos += len + 1
  }
  if (curLineIdx === -1) curLineIdx = lines.length - 1
  if (!lines[curLineIdx] || !lines[curLineIdx].includes('|')) return null

  let start = curLineIdx
  while (start > 0 && lines[start - 1].includes('|')) start--
  let end = curLineIdx
  while (end < lines.length - 1 && lines[end + 1].includes('|')) end++
  if (end - start < 1) return null
  if (!TABLE_DELIM_RE.test(lines[start + 1] || '')) return null

  let tableFrom = 0
  for (let i = 0; i < start; i++) tableFrom += lines[i].length + 1
  let tableTo = tableFrom
  for (let i = start; i <= end; i++) tableTo += lines[i].length + (i < end ? 1 : 0)

  let lineStart = tableFrom
  for (let i = start; i < curLineIdx; i++) lineStart += lines[i].length + 1

  const rowIndex = curLineIdx - start
  const colIndex = cellIndexAtCursor(lines[curLineIdx], cursor - lineStart)

  return { tableFrom, tableTo, text: doc.slice(tableFrom, tableTo), rowIndex, colIndex }
}

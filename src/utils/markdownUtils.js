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

// Parse/serialize/mutate markdown GFM tables as plain data, operando sempre no texto bruto do bloco.

function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function alignFromDelim(cell) {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

export function parseTable(text) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  const header = splitRow(lines[0] || '')
  const delimCells = splitRow(lines[1] || '')
  const aligns = header.map((_, i) => alignFromDelim(delimCells[i] || ''))
  const rows = lines.slice(2).map(splitRow)
  return { header, aligns, rows }
}

function alignDelim(align, width) {
  const w = Math.max(3, width)
  if (align === 'center') return ':' + '-'.repeat(Math.max(1, w - 2)) + ':'
  if (align === 'right') return '-'.repeat(Math.max(1, w - 1)) + ':'
  if (align === 'left') return ':' + '-'.repeat(Math.max(1, w - 1))
  return '-'.repeat(w)
}

export function serializeTable({ header, aligns, rows }) {
  const colCount = header.length
  const widths = Array.from({ length: colCount }, (_, i) => {
    let w = (header[i] || '').length
    rows.forEach((r) => { w = Math.max(w, (r[i] || '').length) })
    return Math.max(3, w)
  })
  const padCell = (s, w) => (s || '').padEnd(w, ' ')
  const rowLine = (cells) => '| ' + Array.from({ length: colCount }, (_, i) => padCell(cells[i], widths[i])).join(' | ') + ' |'
  const delimLine = '| ' + aligns.map((a, i) => alignDelim(a, widths[i])).join(' | ') + ' |'
  return [rowLine(header), delimLine, ...rows.map(rowLine)].join('\n')
}

export function insertRow(table, dataRowIndex, position) {
  const newRow = table.header.map(() => '')
  const insertAt = dataRowIndex == null ? 0 : (position === 'above' ? dataRowIndex : dataRowIndex + 1)
  const rows = [...table.rows]
  rows.splice(insertAt, 0, newRow)
  return { table: { ...table, rows }, newDataRowIndex: insertAt }
}

export function deleteRow(table, dataRowIndex) {
  if (dataRowIndex == null) return { table, focusDataRowIndex: null }
  const rows = table.rows.filter((_, i) => i !== dataRowIndex)
  const focus = Math.min(dataRowIndex, rows.length - 1)
  return { table: { ...table, rows }, focusDataRowIndex: focus }
}

export function moveRow(table, dataRowIndex, direction) {
  if (dataRowIndex == null) return { table, focusDataRowIndex: null }
  const target = direction === 'up' ? dataRowIndex - 1 : dataRowIndex + 1
  if (target < 0 || target >= table.rows.length) return { table, focusDataRowIndex: dataRowIndex }
  const rows = [...table.rows]
  ;[rows[dataRowIndex], rows[target]] = [rows[target], rows[dataRowIndex]]
  return { table: { ...table, rows }, focusDataRowIndex: target }
}

export function insertColumn(table, colIndex, position) {
  const insertAt = position === 'left' ? colIndex : colIndex + 1
  const header = [...table.header]; header.splice(insertAt, 0, 'Coluna')
  const aligns = [...table.aligns]; aligns.splice(insertAt, 0, null)
  const rows = table.rows.map((r) => { const nr = [...r]; nr.splice(insertAt, 0, ''); return nr })
  return { table: { header, aligns, rows }, newColIndex: insertAt }
}

export function deleteColumn(table, colIndex) {
  if (table.header.length <= 1) return { table, focusColIndex: colIndex }
  const header = table.header.filter((_, i) => i !== colIndex)
  const aligns = table.aligns.filter((_, i) => i !== colIndex)
  const rows = table.rows.map((r) => r.filter((_, i) => i !== colIndex))
  const focus = Math.min(colIndex, header.length - 1)
  return { table: { header, aligns, rows }, focusColIndex: focus }
}

export function setAlign(table, colIndex, align) {
  const aligns = [...table.aligns]
  aligns[colIndex] = aligns[colIndex] === align ? null : align
  return { ...table, aligns }
}

// Offset (relativo ao início do bloco serializado) do início da linha pedida.
// rowIndex: 0 = header, 1 = delimitador, 2+ = linhas de dado (rowIndex - 2)
export function offsetForRow(serializedText, rowIndex) {
  const lines = serializedText.split('\n')
  let offset = 0
  for (let i = 0; i < Math.min(rowIndex, lines.length - 1); i++) offset += lines[i].length + 1
  return offset + 2 // pula "| " pra cair dentro da primeira célula
}

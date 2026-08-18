import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

const HEADING_LEVEL = {
  ATXHeading1: 1, ATXHeading2: 2, ATXHeading3: 3,
  ATXHeading4: 4, ATXHeading5: 5, ATXHeading6: 6,
}

// True if any selection range touches [from, to] — used to reveal raw markdown near the cursor
function selectionTouches(state, from, to) {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

function extendPastSpaces(doc, pos, lineEnd) {
  let p = pos
  while (p < lineEnd && doc.sliceString(p, p + 1) === ' ') p++
  return p
}

function listDepth(nodeRef) {
  let depth = 0
  let n = nodeRef.node.parent
  while (n) {
    if (n.type.name === 'BulletList' || n.type.name === 'OrderedList') depth++
    n = n.parent
  }
  return Math.max(1, depth)
}

function buildDecorations(view) {
  const { state } = view
  const items = []
  const hide = (from, to) => items.push({ from, to, deco: Decoration.replace({}) })
  const mark = (from, to, className) => items.push({ from, to, deco: Decoration.mark({ class: className }) })
  const line = (pos, className) => items.push({ from: pos, to: pos, deco: Decoration.line({ class: className }) })

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        const type = node.type.name

        const headingLevel = HEADING_LEVEL[type]
        if (headingLevel) {
          const docLine = state.doc.lineAt(node.from)
          line(docLine.from, `cm-live-h${headingLevel}`)
          return
        }

        if (type === 'HeaderMark') {
          const docLine = state.doc.lineAt(node.from)
          if (!selectionTouches(state, docLine.from, docLine.to)) {
            hide(node.from, extendPastSpaces(state.doc, node.to, docLine.to))
          }
          return
        }

        if (type === 'StrongEmphasis') { mark(node.from, node.to, 'cm-live-strong'); return }
        if (type === 'Emphasis') { mark(node.from, node.to, 'cm-live-em'); return }
        if (type === 'InlineCode') { mark(node.from, node.to, 'cm-live-code'); return }
        if (type === 'StrikethroughMark' || type === 'Strikethrough') { mark(node.from, node.to, 'cm-live-strike'); return }

        if (type === 'EmphasisMark' || type === 'CodeMark') {
          const parent = node.node.parent
          if (parent && !selectionTouches(state, parent.from, parent.to)) {
            hide(node.from, node.to)
          }
          return
        }

        if (type === 'ListMark') {
          const depth = listDepth(node)
          mark(node.from, node.to, `cm-live-list-d${((depth - 1) % 4) + 1}`)
          return
        }

        if (type === 'QuoteMark') { mark(node.from, node.to, 'cm-live-quote'); return }
      },
    })
  }

  items.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(
    items.map((i) => i.deco.range(i.from, i.to)),
    true
  )
}

export function markdownLivePreview() {
  return ViewPlugin.fromClass(
    class {
      decorations
      constructor(view) { this.decorations = buildDecorations(view) }
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )
}

export const livePreviewTheme = EditorView.baseTheme({
  '.cm-live-h1': { fontSize: '1.6em', fontWeight: '700', color: 'var(--color-primary)', lineHeight: '1.4' },
  '.cm-live-h2': { fontSize: '1.4em', fontWeight: '700', color: 'var(--color-primary)', lineHeight: '1.4' },
  '.cm-live-h3': { fontSize: '1.22em', fontWeight: '700', lineHeight: '1.4' },
  '.cm-live-h4': { fontSize: '1.1em', fontWeight: '700', lineHeight: '1.4' },
  '.cm-live-h5': { fontSize: '1.03em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-live-h6': { fontSize: '1em', fontWeight: '600', opacity: '0.85', lineHeight: '1.4' },
  '.cm-live-strong': { fontWeight: '700' },
  '.cm-live-em': { fontStyle: 'italic' },
  '.cm-live-strike': { textDecoration: 'line-through', opacity: '0.7' },
  '.cm-live-code': {
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    padding: '0 4px',
    color: '#f5c2e7',
  },
  '.cm-live-quote': { color: '#6c7086' },
  '.cm-live-list-d1': { color: '#89b4fa', fontWeight: '700' },
  '.cm-live-list-d2': { color: '#a6e3a1', fontWeight: '700' },
  '.cm-live-list-d3': { color: '#f9e2af', fontWeight: '700' },
  '.cm-live-list-d4': { color: '#cba6f7', fontWeight: '700' },
})

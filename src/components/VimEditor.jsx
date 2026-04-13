import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, scrollPastEnd } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { indentUnit, indentOnInput } from '@codemirror/language'
import { indentWithTab, history } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { vim, Vim, getCM } from '@replit/codemirror-vim'

// Compartments for dynamic configuration
const lineNumbersCompartment  = new Compartment()
const cursorLineCompartment   = new Compartment()
const indentUnitCompartment   = new Compartment()
const tabSizeCompartment      = new Compartment()
const smartIndentCompartment  = new Compartment()
const languageCompartment     = new Compartment()
const scrollMarginCompartment = new Compartment()
const wrapCompartment         = new Compartment()

const appTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    background: 'transparent',
    color: '#cdd6f4',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  '.cm-scroller': { flex: '1 1 0', overflow: 'auto' },
  '.cm-content': { padding: '2rem', caretColor: 'var(--color-primary)', lineHeight: '1.7' },
  '.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--color-primary)', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(203,166,247,0.04)' },
  '.cm-gutters': {
    background: 'rgba(14,14,26,0.85)',
    borderRight: '1px solid #313244',
    color: '#45475a',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', minWidth: '36px', textAlign: 'right' },
  '.cm-panels': { background: '#181825' },
  '.cm-panels-bottom': { borderTop: '1px solid #45475a' },
  '.cm-vim-panel': {
    background: '#181825',
    color: '#cdd6f4',
    padding: '2px 10px',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  '.cm-vim-panel input': {
    background: 'transparent',
    color: '#cdd6f4',
    outline: 'none',
    border: 'none',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    width: '100%',
  },
  '.cm-selectionBackground': { backgroundColor: 'rgba(203,166,247,0.35) !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(203,166,247,0.35) !important' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { backgroundColor: 'rgba(203,166,247,0.35) !important' },
  '::selection': { backgroundColor: 'rgba(203,166,247,0.35)' },
}, { dark: true })

const MODE_COLOR = { NORMAL: '#a6e3a1', INSERT: '#89b4fa', VISUAL: '#f9e2af', REPLACE: '#f38ba8' }

let vimOptionsInitialized = false
function initVimOptions() {
  if (vimOptionsInitialized) return
  vimOptionsInitialized = true

  Vim.defineEx('write', 'w', (cm) => {
    const view = cm.cm6Client || cm.view
    if (view && cm.onSave) {
        cm.onSave(view.state.doc.toString())
        if (cm.showStatus) cm.showStatus("💾 Nota salva!")
    }
  })
  Vim.defineEx('wq', 'wq', (cm) => {
    const view = cm.cm6Client || cm.view
    if (view && cm.onSave) {
        cm.onSave(view.state.doc.toString())
        if (cm.showStatus) cm.showStatus("💾 Nota salva!")
        if (cm.onClose) setTimeout(() => cm.onClose(), 300)
    }
  })
  Vim.defineEx('quit', 'q', (cm) => {
    if (cm.onClose) cm.onClose()
  })

  const noop = () => {}
  Vim.defineOption('number',        false,  'boolean', ['nu'],  noop)
  Vim.defineOption('relativenumber',false,  'boolean', ['rnu'], noop)
  Vim.defineOption('cursorline',    false,  'boolean', ['cul'], noop)
  Vim.defineOption('scrolloff',     0,      'number',  ['so'],  noop)
  Vim.defineOption('tabstop',       4,      'number',  ['ts'],  noop)
  Vim.defineOption('expandtab',     false,  'boolean', ['et'],  noop)
  Vim.defineOption('smartindent',   true,   'boolean', ['si'],  noop)
  Vim.defineOption('shiftwidth',    4,      'number',  ['sw'],  noop)
  Vim.defineOption('softtabstop',   4,      'number',  ['sts'], noop)
  // Extra options — registered so vimrc doesn't throw on unknown option
  Vim.defineOption('wrap',          true,   'boolean', [],      noop)
  Vim.defineOption('linebreak',     false,  'boolean', ['lbr'], noop)
  Vim.defineOption('clipboard',     '',     'string',  ['cb'],  noop)
  Vim.defineOption('ignorecase',    false,  'boolean', ['ic'],  noop)
  Vim.defineOption('smartcase',     false,  'boolean', ['scs'], noop)
  Vim.defineOption('hlsearch',      false,  'boolean', ['hls'], noop)
  Vim.defineOption('incsearch',     false,  'boolean', ['is'],  noop)
}

const VimEditor = forwardRef(function VimEditor({ value, onChange, onSave, onCloseTab, font, vimrc, language }, ref) {
  const containerRef  = useRef(null)
  const viewRef       = useRef(null)
  const lastValueRef  = useRef(value)
  const onSaveRef     = useRef(onSave)
  const suppressRef   = useRef(false)
  const [mode, setMode] = useState('NORMAL')
  const [status, setStatus] = useState(null)
  const statusTimeout = useRef(null)

  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  initVimOptions()

  const showStatus = (msg) => {
    setStatus(msg)
    if (statusTimeout.current) clearTimeout(statusTimeout.current)
    statusTimeout.current = setTimeout(() => setStatus(null), 2000)
  }

  useImperativeHandle(ref, () => ({
    insertText: (text) => {
      const view = viewRef.current
      if (!view) return
      const { from } = view.state.selection.main
      view.dispatch({ changes: { from, insert: text }, selection: { anchor: from + text.length } })
      view.focus()
    },
    // Replace [[partial with [[Title]] — used by wiki autocomplete
    replaceWikiText: (title) => {
      const view = viewRef.current
      if (!view) return
      const { from } = view.state.selection.main
      const docText = view.state.doc.toString()
      const before = docText.slice(0, from)
      const openIdx = before.lastIndexOf('[[')
      if (openIdx === -1) return
      const replacement = `[[${title}]]`
      view.dispatch({
        changes: { from: openIdx, to: from, insert: replacement },
        selection: { anchor: openIdx + replacement.length },
      })
      view.focus()
    },
    getCursorAndDoc: () => {
      const view = viewRef.current
      if (!view) return null
      return { cursor: view.state.selection.main.from, doc: view.state.doc.toString() }
    },
  }))

  // Parse vimrc and apply options directly to CodeMirror compartments.
  // Does NOT rely on Vim.getOption — that bridge is unreliable for compartment sync.
  const applyVimrc = (vimrcText, view) => {
    if (!view) return

    // Defaults
    let number = false, relativenumber = false, cursorline = false
    let scrolloff = 0, tabstop = 4, shiftwidth = 4, expandtab = false, wrap = true

    vimrcText.split('\n').forEach(rawLine => {
      let l = rawLine.trim()
      if (!l || l.startsWith('"')) return
      if (l.startsWith(':')) l = l.slice(1)
      if (!/^set\s/.test(l)) return

      l.slice(4).trim().split(/\s+/).forEach(opt => {
        switch (opt) {
          case 'number':         case 'nu':           number = true;           break
          case 'nonumber':       case 'nonu':         number = false;          break
          case 'relativenumber': case 'rnu':          relativenumber = true;   break
          case 'norelativenumber':case 'nornu':       relativenumber = false;  break
          case 'cursorline':     case 'cul':          cursorline = true;       break
          case 'nocursorline':   case 'nocul':        cursorline = false;      break
          case 'wrap':                                wrap = true;             break
          case 'nowrap':                              wrap = false;            break
          case 'expandtab':      case 'et':           expandtab = true;        break
          case 'noexpandtab':    case 'noet':         expandtab = false;       break
          default: {
            const kv = opt.match(/^(scrolloff|so|tabstop|ts|shiftwidth|sw|softtabstop|sts)=(\d+)$/)
            if (kv) {
              const v = parseInt(kv[2])
              if (kv[1] === 'scrolloff' || kv[1] === 'so') scrolloff = v
              else if (kv[1] === 'tabstop'   || kv[1] === 'ts')  tabstop = v
              else if (kv[1] === 'shiftwidth' || kv[1] === 'sw')  shiftwidth = v
            }
          }
        }
      })
    })

    const numMode = (number && relativenumber) ? 'hybrid' : relativenumber ? 'relative' : number ? 'absolute' : 'none'
    applyNumbers(view, numMode)

    view.dispatch({ effects: [
      cursorLineCompartment.reconfigure(cursorline ? highlightActiveLine() : []),
      scrollMarginCompartment.reconfigure(
        scrolloff > 0 ? EditorView.scrollMargins.of(() => ({ top: scrolloff * 14, bottom: scrolloff * 14 })) : []
      ),
      tabSizeCompartment.reconfigure(EditorState.tabSize.of(tabstop)),
      indentUnitCompartment.reconfigure(indentUnit.of(expandtab ? ' '.repeat(shiftwidth) : '\t')),
      wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    ]})
  }

  const applyNumbers = (view, mode) => {
    if (!view) return
    let ext
    if (mode === 'absolute') ext = lineNumbers()
    else if (mode === 'relative' || mode === 'hybrid') {
      ext = lineNumbers({
        formatNumber: (lineNo, state) => {
          const cursor = state.selection.main.head
          const curLine = state.doc.lineAt(cursor).number
          const diff = Math.abs(lineNo - curLine)
          if (diff === 0) return mode === 'hybrid' ? String(lineNo) : '0'
          return String(diff)
        },
      })
    } else ext = []
    view.dispatch({ effects: lineNumbersCompartment.reconfigure(ext) })
  }

  useEffect(() => {
    if (!containerRef.current) return
    
    const state = EditorState.create({
      doc: lastValueRef.current,
      extensions: [
        // ── GOVERNANCE ──
        // vim() must come first; no Prec wrapper — it handles its own event priority
        vim(),

        // Tab indentation
        keymap.of([indentWithTab]),
        
        appTheme,
        wrapCompartment.of(EditorView.lineWrapping),
        scrollPastEnd(),

        languageCompartment.of(language || markdown()),
        lineNumbersCompartment.of([]),
        cursorLineCompartment.of([]),
        scrollMarginCompartment.of([]),
        indentUnitCompartment.of(indentUnit.of("    ")),
        tabSizeCompartment.of(EditorState.tabSize.of(4)),
        smartIndentCompartment.of(indentOnInput()),

        history(),
        drawSelection({ drawRangeCursor: false }),
        EditorView.contentAttributes.of({ style: `font-family: '${font || 'Inter'}', sans-serif` }),
        
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressRef.current) {
            const newVal = update.state.doc.toString()
            lastValueRef.current = newVal
            onChange(newVal)
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    const cm = getCM(view)
    if (cm) {
      cm.view = view
      cm.onSave = (content) => onSaveRef.current?.(content)
      cm.onClose = onCloseTab
      cm.showStatus = showStatus
      cm.on('vim-mode-change', ({ mode: m }) => {
        if (m === 'visual') setMode('VISUAL')
        else if (m === 'insert') setMode('INSERT')
        else if (m === 'replace') setMode('REPLACE')
        else setMode('NORMAL')
      })

      if (vimrc) {
        setTimeout(() => { applyVimrc(vimrc, viewRef.current) }, 50)
      }
    }

    return () => { if (viewRef.current) viewRef.current.destroy() }
  }, [font])

  useEffect(() => {
    if (viewRef.current && language) {
        viewRef.current.dispatch({ effects: languageCompartment.reconfigure(language) })
    }
  }, [language])

  // Re-apply when user saves new vimrc in settings
  useEffect(() => {
    if (viewRef.current && vimrc) applyVimrc(vimrc, viewRef.current)
  }, [vimrc])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      suppressRef.current = true
      lastValueRef.current = value
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
      suppressRef.current = false
    }
  }, [value])

  const modeColor = MODE_COLOR[mode] || '#a6adc8'

  return (<div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        {status && (
            <div style={{
                position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(166,227,161,0.95)', color: '#111', padding: '6px 16px',
                borderRadius: 20, fontSize: 12, fontWeight: 700, zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none',
            }}>
                {status}
            </div>
        )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        padding: '6px 14px', background: 'rgba(14,14,26,0.95)', borderBottom: '1px solid #1e1e2e',
      }}>
        <span style={{
          fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
          letterSpacing: '0.08em', color: '#1e1e2e', background: modeColor,
          padding: '2px 10px', borderRadius: 3, transition: 'background 0.1s',
        }}>{mode}</span>
        <span style={{ fontSize: 13, color: '#585b70', fontFamily: "'JetBrains Mono', monospace" }}>
          i · inserir &nbsp;|&nbsp; Esc · normal &nbsp;|&nbsp; :w · salvar &nbsp;|&nbsp; :set number
        </span>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} />
    </div>)
})

export default VimEditor

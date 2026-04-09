import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Eye, EyeOff, Edit3, Columns, Network, MessageSquare,
  Bold, Italic, Strikethrough, Code, Link2, Hash,
  Heading1, Heading2, List, ListOrdered, Quote, Minus,
  CheckSquare, Table, Sparkles, Upload, StopCircle, Workflow, Type,
  MousePointer2, Square, ArrowUpRight, X,
} from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import MarkdownPreview from './MarkdownPreview'
import BacklinksPanel from './BacklinksPanel'
import InlineGraph from './InlineGraph'
import ChatPanel from './ChatPanel'
import DiagramView from './DiagramView'

// ── Balloon animation ─────────────────────────────────────────────────────────
const BALLOON_EMOJIS = ['🎈', '🎉', '🎊', '🎈', '🎈', '🎉', '🎊', '🎈', '✨', '🌟']
function BalloonOverlay({ onDone }) {
  const items = Array.from({ length: 22 }, (_, i) => ({
    emoji:    BALLOON_EMOJIS[i % BALLOON_EMOJIS.length],
    left:     Math.random() * 95,
    size:     1.4 + Math.random() * 1.6,
    duration: 2.8 + Math.random() * 2.2,
    delay:    Math.random() * 1.2,
  }))
  useEffect(() => {
    const t = setTimeout(onDone, 5000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {items.map((b, i) => (
        <span
          key={i}
          className="balloon"
          style={{
            left: `${b.left}%`,
            bottom: '-8%',
            fontSize: `${b.size}rem`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  )
}

const MODES = [
  { id: 'edit',       icon: Edit3,     label: 'Editar',   title: 'Somente editor' },
  { id: 'split',      icon: Columns,   label: 'Split',    title: 'Editor + Preview' },
  { id: 'preview',    icon: Eye,       label: 'Preview',  title: 'Somente preview' },
  { id: 'graph',      icon: Network,   label: 'Grafo',    title: 'Editor + Preview + Grafo' },
  { id: 'graph-full', icon: Network,   label: 'Grafo Full', title: 'Grafo em Tela Cheia' },
  { id: 'chat',       icon: MessageSquare, label: 'Chat', title: 'Editor + Preview + Chat' },
]

const NOTE_FONTS = [
  'Inter', 'Roboto', 'JetBrains Mono', 'Fira Code', 'Merriweather', 'IBM Plex Mono',
]
const noteFontKey = (id) => `personal-brain-note-font-${id}`

const FORMAT_GROUPS = [
  [
    { icon: Heading1,     title: 'Título H1',        before: '# ',          after: '',    block: true },
    { icon: Heading2,     title: 'Título H2',        before: '## ',         after: '',    block: true },
  ],
  [
    { icon: Bold,         title: 'Negrito (Ctrl+B)', before: '**',          after: '**' },
    { icon: Italic,       title: 'Itálico (Ctrl+I)', before: '*',           after: '*'  },
    { icon: Strikethrough,title: 'Tachado',          before: '~~',          after: '~~' },
    { icon: Code,         title: 'Código inline',    before: '`',           after: '`'  },
  ],
  [
    { icon: Link2, title: 'Wiki link [[...]]', before: '[[', after: ']]', color: '#cba6f7' },
    { icon: Hash,  title: 'Tag #...',          before: '#',  after: '',   color: '#89b4fa' },
  ],
  [
    { icon: List,        title: 'Lista',           before: '- ',      after: '', block: true },
    { icon: ListOrdered, title: 'Lista numerada',  before: '1. ',     after: '', block: true },
    { icon: CheckSquare, title: 'Checklist',       before: '- [ ] ', after: '', block: true },
    { icon: Quote,       title: 'Citação',         before: '> ',      after: '', block: true },
  ],
  [
    { icon: Minus, title: 'Separador', before: '\n---\n', after: '', block: true },
    { icon: Table, title: 'Tabela',    before: '| Col A | Col B |\n|-------|-------|\n| ', after: ' |  |' },
  ],
]

// Detecta se o cursor está dentro de [[...]] ainda incompleto
function getWikiQuery(value, cursor) {
  const before = value.slice(0, cursor)
  const open = before.lastIndexOf('[[')
  if (open === -1) return null
  const between = before.slice(open + 2)
  // Se tem ]] ou quebra de linha entre [[ e cursor → não é wikilink
  if (between.includes(']]') || between.includes('\n')) return null
  return between // texto parcial digitado
}

export default function Editor({ onImport }) {
  const { getActiveNote, updateNote, notes, openTabs, closeTab, setActiveNote, activeNoteId } = useNotesStore()
  const activeNote = getActiveNote()

  const [mode, setMode] = useState('split')

  // ── Textarea UNCONTROLLED ─────────────────────────────────────────────────
  // O textarea não tem prop `value` — o browser gerencia valor e cursor nativamente.
  // Só setamos o conteúdo via DOM imperativamente quando a nota ativa muda.
  // Isso preserva undo nativo (Ctrl+Z) e nunca move o cursor.
  const lastNoteId = useRef(null)
  // Estado separado só para o preview (não passa pelo textarea)
  const [previewContent, setPreviewContent] = useState('')

  useEffect(() => {
    if (!activeNote) return
    const val = activeNote.content || ''
    if (activeNote.id !== lastNoteId.current) {
      // Note switched — always sync textarea + preview
      lastNoteId.current = activeNote.id
      if (textareaRef.current) textareaRef.current.value = val
      setPreviewContent(val)
    } else if (!previewContent && val) {
      // Content arrived AFTER initial render (async decryption on F5)
      if (textareaRef.current) textareaRef.current.value = val
      setPreviewContent(val)
    } else if (textareaRef.current && textareaRef.current.value !== previewContent) {
      textareaRef.current.value = previewContent
    }
  }, [activeNote?.id, activeNote?.content, mode])

  const textareaRef = useRef(null)
  const saveTimeout = useRef(null)

  // ── AI formatting ─────────────────────────────────────────────────────────
  const [aiStatus, setAiStatus]     = useState(null)
  const [aiProgress, setAiProgress] = useState({ chunk: 0, total: 0 })
  const [aiTranslate, setAiTranslate] = useState(false)
  const [showBalloons, setShowBalloons] = useState(false)
  const [activeDiagramTool, setActiveDiagramTool] = useState('select') // select, rect, arrow
  const aiAbortRef = useRef(null) // AbortController for AI cancel

  // ── Content hide toggle — PER NOTE (persisted) ───────────────────────
  const noteHideKey = (id) => `personal-brain-hidden-${id}`
  const [contentHidden, setContentHidden] = useState(false)

  // Update hidden state whenever active note changes
  useEffect(() => {
    if (!activeNote) { setContentHidden(false); return }
    setContentHidden(localStorage.getItem(noteHideKey(activeNote.id)) === '1')
  }, [activeNote?.id])

  const toggleHide = () => {
    if (!activeNote) return
    const next = !contentHidden
    localStorage.setItem(noteHideKey(activeNote.id), next ? '1' : '0')
    setContentHidden(next)
  }

  // When un-hiding, sync the textarea (it was unmounted while hidden)
  useEffect(() => {
    if (!contentHidden && activeNote && textareaRef.current) {
      const val = activeNote.content || ''
      if (!textareaRef.current.value) {
        textareaRef.current.value = val
        setPreviewContent(val)
      }
    }
  }, [contentHidden])

  // ── Per-note font-family ─────────────────────────────────────────────
  const [noteFont, setNoteFont] = useState('Inter')
  useEffect(() => {
    if (!activeNote) return
    setNoteFont(localStorage.getItem(noteFontKey(activeNote.id)) || 'Inter')
  }, [activeNote?.id])
  const changeNoteFont = (f) => {
    setNoteFont(f)
    if (activeNote) localStorage.setItem(noteFontKey(activeNote.id), f)
  }

  const handleAiFormat = useCallback(async () => {
    const ta = textareaRef.current
    if (!ta || !activeNote) return

    const selStart = ta.selectionStart
    const selEnd   = ta.selectionEnd
    const hasSelection = selStart !== selEnd

    const { settings } = useNotesStore.getState()
    const ai_model = settings.extra?.aiModel || 'gemma3:12b'

    const confirmed = window.confirm(
      `✨ Formatar ${hasSelection ? 'trecho selecionado' : 'nota completa'} com IA (${ai_model})?` +
      `${aiTranslate ? '\n🌐 Tradução para português ativada.' : ''}` +
      '\n\nClique OK para continuar.'
    )
    if (!confirmed) return

    // Captura o conteúdo a enviar e a posição para reinserção
    const fullText      = ta.value
    const contentToSend = hasSelection ? fullText.slice(selStart, selEnd) : fullText

    setAiStatus('formatting')
    setAiProgress({ chunk: 0, total: 0 })

    // Create new AbortController for this session
    const controller = new AbortController()
    aiAbortRef.current = controller

    // Aplica o conteúdo formatado de volta no lugar certo
    const applyContent = (formatted) => {
      const newVal = hasSelection
        ? fullText.slice(0, selStart) + formatted + fullText.slice(selEnd)
        : formatted
      ta.value = newVal
      setPreviewContent(newVal)
      return newVal
    }

    try {
      const response = await fetch(`http://${window.location.hostname}:3001/api/ai/format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          content:   contentToSend,
          title:     activeNote.title,
          notes:     notes.filter(n => n.id !== activeNote.id).map(n => ({ id: n.id, title: n.title })),
          translate: aiTranslate,
          ai_model:  ai_model,
        }),
      })
      if (!response.ok) throw new Error(`Servidor: ${response.statusText}`)

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'start') {
              setAiProgress({ chunk: 0, total: evt.total })
            } else if (evt.type === 'progress') {
              setAiProgress({ chunk: evt.chunk, total: evt.total })
            } else if (evt.type === 'partial') {
              applyContent(evt.content)
              setAiProgress({ chunk: evt.chunk, total: evt.total })
            } else if (evt.type === 'linking') {
              setAiStatus('linking')
            } else if (evt.type === 'done') {
              const newVal = applyContent(evt.content)
              updateNote(activeNote.id, { content: newVal })
              setAiStatus('done')
              setShowBalloons(true)
            } else if (evt.type === 'error') {
              throw new Error(evt.message)
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[AI] Cancelado pelo usuário')
      } else {
        alert(`Erro na formatação IA: ${err.message}`)
      }
    } finally {
      aiAbortRef.current = null
      setAiStatus(null)
    }
  }, [activeNote, notes, updateNote, aiTranslate])

  // ── Wiki autocomplete ─────────────────────────────────────────────────────
  const [wikiSuggest, setWikiSuggest] = useState(null)
  // { query: string, items: Note[], selectedIdx: number }
  const suggestRef = useRef(null)

  // ── onChange: só atualiza preview + debounce save; NÃO toca o textarea ──
  const handleChange = (e) => {
    const content = e.target.value
    const cursor  = e.target.selectionStart

    // Atualiza preview sem tocar no textarea
    setPreviewContent(content)

    // Debounce save no store
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content })
    }, 600)

    // Wiki autocomplete
    const query = getWikiQuery(content, cursor)
    if (query !== null) {
      const q = query.toLowerCase()
      const items = notes
        .filter((n) => n.id !== activeNote?.id && n.title.toLowerCase().includes(q))
        .slice(0, 6)
      setWikiSuggest({ query, items, selectedIdx: 0 })
    } else {
      setWikiSuggest(null)
    }
  }

  // Seleciona sugestão e completa o wikilink
  const applySuggestion = (title) => {
    const ta = textareaRef.current
    if (!ta) return
    const cursor = ta.selectionStart
    const val    = ta.value
    const open   = val.lastIndexOf('[[', cursor)
    if (open === -1) return

    const before    = val.slice(0, open)
    const after     = val.slice(cursor)
    const newVal    = `${before}[[${title}]]${after}`
    const newCursor = before.length + title.length + 4

    // Atualiza diretamente no DOM (uncontrolled)
    ta.value = newVal
    ta.setSelectionRange(newCursor, newCursor)
    ta.focus()

    setPreviewContent(newVal)
    setWikiSuggest(null)

    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content: newVal })
    }, 300)
  }

  // Teclas dentro do autocomplete
  const handleKeyDown = (e) => {
    if (!wikiSuggest || wikiSuggest.items.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setWikiSuggest((s) => ({ ...s, selectedIdx: Math.min(s.selectedIdx + 1, s.items.length - 1) }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setWikiSuggest((s) => ({ ...s, selectedIdx: Math.max(s.selectedIdx - 1, 0) }))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const item = wikiSuggest.items[wikiSuggest.selectedIdx]
      if (item) { e.preventDefault(); applySuggestion(item.title) }
    } else if (e.key === 'Escape') {
      setWikiSuggest(null)
    }
  }

  // Atalhos de modo e diagramas
  useEffect(() => {
    const handler = (e) => {
      const isInput = document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT'
      if (document.activeElement === textareaRef.current) {
        if (e.ctrlKey && e.key === 'b') { e.preventDefault(); insertText('**', '**') }
        if (e.ctrlKey && e.key === 'i') { e.preventDefault(); insertText('*', '*') }
      }
      
      // Diagram shortcuts (only if not typing in an input)
      if (!isInput) {
        if (e.key.toLowerCase() === 'v') setActiveDiagramTool('select')
        if (e.key.toLowerCase() === 'r') setActiveDiagramTool('rect')
        if (e.key.toLowerCase() === 's') setActiveDiagramTool('arrow')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeNote, activeDiagramTool])

  // Inserção de formatação via execCommand — preserva undo nativo (Ctrl+Z)
  const insertText = (before, after = '', block = false) => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()

    const start    = ta.selectionStart
    const end      = ta.selectionEnd
    const val      = ta.value
    const selected = val.slice(start, end)

    if (block) {
      // Move cursor pro início da linha e insere o prefixo
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      ta.setSelectionRange(lineStart, lineStart)
      document.execCommand('insertText', false, before)
    } else {
      // Substitui seleção por before+seleção+after
      document.execCommand('insertText', false, before + selected + after)
      // Reposiciona cursor antes do `after` quando não tinha seleção
      if (!selected && after) {
        const pos = ta.selectionStart - after.length
        ta.setSelectionRange(pos, pos)
      }
    }

    setPreviewContent(ta.value)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content: ta.value })
    }, 300)
  }

  const insertDiagram = () => {
    const defaultData = JSON.stringify({ _id: `diag-${Date.now()}`, nodes: [], edges: [] }, null, 2)
    const block = `\n\`\`\`diagram\n${defaultData}\n\`\`\`\n`
    insertText(block)
    setMode('split')
  }

  const handleDiagramUpdate = (oldJson, newJson) => {
    const ta = textareaRef.current
    if (!ta) return
    const currentVal = ta.value
    // Replace the specific JSON chunk. This is safe because diagram JSON is very structured.
    const newVal = currentVal.replace(oldJson, newJson)
    if (newVal !== currentVal) {
      ta.value = newVal
      setPreviewContent(newVal)
      if (activeNote) updateNote(activeNote.id, { content: newVal })
    }
  }

  // ── Resizable panel widths ────────────────────────────────────────────────
  const [splitLeft,  setSplitLeft]  = useState(50)
  const [triLeft,    setTriLeft]    = useState(33)
  const [triMid,     setTriMid]     = useState(33)
  const panelDrag = useRef(null)

  useEffect(() => {
    const onMove = (e) => {
      if (!panelDrag.current) return
      const dx = e.clientX - panelDrag.current.startX
      const containerW = document.getElementById('editor-content-area')?.offsetWidth || window.innerWidth
      const deltaPct = (dx / containerW) * 100
      if (panelDrag.current.type === 'split') {
        setSplitLeft(Math.max(15, Math.min(85, panelDrag.current.startVal + deltaPct)))
      } else if (panelDrag.current.type === 'tri-left') {
        const newLeft = Math.max(10, Math.min(80, panelDrag.current.startVal + deltaPct))
        const diff    = newLeft - panelDrag.current.startVal
        setTriLeft(newLeft)
        setTriMid(Math.max(10, Math.min(80, panelDrag.current.startVal2 - diff)))
      } else if (panelDrag.current.type === 'tri-mid') {
        setTriMid(Math.max(10, Math.min(80, panelDrag.current.startVal + deltaPct)))
      }
    }
    const onUp = () => {
      if (panelDrag.current) {
        panelDrag.current = null
        document.body.style.cursor    = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Home screen when no tabs are open
  if (!activeNote || openTabs.length === 0) {
    const homeNote = notes.find(n => n.title === '🚀 Últimas Novidades')
    return (
      <div className="flex flex-col h-full" style={{ background: 'rgba(14,14,26,0.4)' }}>
        {/* Tab bar — empty state */}
        <div className="flex items-center flex-shrink-0 overflow-x-auto" style={{ background: 'rgba(18,18,30,0.8)', borderBottom: '1px solid #313244', minHeight: 36 }}>
          <div className="px-4 text-[10px] text-ui-muted italic">Nenhuma aba aberta</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-ui-muted">
            <div className="text-5xl mb-4 opacity-30">⬡</div>
            <div className="text-sm mb-2">Selecione uma nota para abrir</div>
            {homeNote && (
              <button
                onClick={() => setActiveNote(homeNote.id)}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--color-primary)', color: '#1e1e2e' }}
              >
                🚀 Ver Últimas Novidades
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const showEditor  = mode === 'edit' || mode === 'split' || mode === 'graph' || mode === 'chat'
  const showPreview = mode === 'preview' || mode === 'split' || mode === 'graph' || mode === 'chat'
  const showGraph   = mode === 'graph' || mode === 'graph-full'
  const showChat    = mode === 'chat'

  const startPanelDrag = (type, e) => {
    e.preventDefault()
    panelDrag.current = { type, startX: e.clientX, startVal: type === 'split' ? splitLeft : type === 'tri-left' ? triLeft : triMid, startVal2: triMid }
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const ResizeHandle = ({ onDragStart }) => (
    <div
      onMouseDown={onDragStart}
      style={{
        width: 4, flexShrink: 0, cursor: 'col-resize',
        background: '#313244', transition: 'background 0.15s', zIndex: 10,
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
      onMouseOut={(e)  => (e.currentTarget.style.background = '#313244')}
    />
  )

  const editorPct  = mode === 'edit' ? 100 : mode === 'preview' ? 0 : (mode === 'graph' || mode === 'chat') ? triLeft : splitLeft
  const previewPct = mode === 'preview' ? 100 : mode === 'edit' ? 0 : (mode === 'graph' || mode === 'chat') ? triMid : (100 - splitLeft)
  const thirdPct   = 100 - triLeft - triMid

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(14,14,26,0.4)' }}>
      {/* ── Tab bar ── */}
      <div
        className="flex items-end flex-shrink-0 overflow-x-auto"
        style={{ background: 'rgba(14,14,26,0.9)', borderBottom: '1px solid #313244', minHeight: 34 }}
      >
        {openTabs.map((tabId) => {
          const tabNote = notes.find(n => n.id === tabId)
          if (!tabNote) return null
          const isActive = tabId === activeNoteId
          return (
            <div
              key={tabId}
              onClick={() => setActiveNote(tabId)}
              className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer flex-shrink-0 group transition-colors"
              style={{
                maxWidth: 180,
                background: isActive ? 'rgba(37,37,53,0.9)' : 'transparent',
                borderRight: '1px solid #313244',
                borderTop: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                color: isActive ? 'var(--color-primary)' : '#6c7086',
              }}
            >
              <span className="text-[11px] truncate flex-1" style={{ maxWidth: 120 }}>{tabNote.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tabId) }}
                className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                style={{ color: 'inherit' }}
                title="Fechar aba"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: 'rgba(22,22,34,0.5)' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-ui-accent text-sm">⬡</span>
          <span className="text-ui-text text-sm font-medium truncate">{activeNote.title}</span>
          <span className="text-ui-muted text-xs hidden sm:block">
            {new Date(activeNote.updated_at || activeNote.updatedAt).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}
          </span>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(37,37,53,0.5)' }}>
          {MODES.map(({ id, icon: Icon, label, title }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              title={title}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                mode === id ? 'text-ui-accent font-semibold' : 'text-ui-muted hover:text-ui-text'
              }`}
              style={mode === id ? { background: 'rgba(49,49,85,0.6)' } : {}}
            >
              <Icon size={13} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Formatting toolbar ── */}
      {showEditor && (
        <div
          className="flex items-center gap-0.5 px-3 py-1.5 flex-shrink-0 flex-wrap"
          style={{ borderBottom: '1px solid #313244', background: 'rgba(25,25,40,0.5)' }}
        >
          {FORMAT_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#313244' }} />}
              {group.map(({ icon: Icon, title, before, after, block, color }) => (
                <button
                  key={title}
                  onMouseDown={(e) => { e.preventDefault(); insertText(before, after, block) }}
                  title={title}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
                  style={{ color: color || '#a6adc8' }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </React.Fragment>
          ))}

          {/* IA format button + translate checkbox + cancel */}
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#313244' }} />
          <label
            className="flex items-center gap-1 px-1.5 py-1 rounded text-xs cursor-pointer select-none hover:bg-ui-hover"
            title="Traduzir para português"
            onMouseDown={(e) => e.preventDefault()}
            style={{ color: aiTranslate ? '#89b4fa' : '#585b70' }}
          >
            <input
              type="checkbox"
              checked={aiTranslate}
              onChange={(e) => setAiTranslate(e.target.checked)}
              className="accent-blue-400 w-3 h-3"
            />
            <span className="hidden sm:inline">Traduzir?</span>
          </label>
          <button
            onMouseDown={(e) => { e.preventDefault(); if (!aiStatus) handleAiFormat() }}
            disabled={!!aiStatus}
            title={aiStatus ? `Formatando… ${aiProgress.chunk}/${aiProgress.total}` : 'Formatar com IA (Ollama) — usa seleção se houver'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all ${
              aiStatus ? 'cursor-not-allowed' : 'hover:bg-ui-hover cursor-pointer'
            }`}
            style={{ color: aiStatus ? '#f9e2af' : '#a6e3a1' }}
          >
            <Sparkles size={14} className={aiStatus ? 'ai-pulse' : ''} />
            <span className="hidden sm:inline">
              {aiStatus === 'formatting'
                ? `IA ${aiProgress.chunk}/${aiProgress.total}`
                : aiStatus === 'linking'
                ? 'Linkando…'
                : 'IA'}
            </span>
          </button>
          {/* Cancel AI button — only shown while processing */}
          {aiStatus && (
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                aiAbortRef.current?.abort()
              }}
              title="Cancelar processamento da IA"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
              style={{ color: '#f38ba8' }}
            >
              <StopCircle size={13} />
              <span className="hidden sm:inline">Parar</span>
            </button>
          )}

          {/* Import + Hide + Font — at end of toolbar */}
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#313244' }} />
          <button
            onMouseDown={(e) => { e.preventDefault(); onImport?.() }}
            title="Importar arquivos (.md, .txt)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs hover:bg-ui-hover transition-all"
            style={{ color: 'var(--color-secondary)' }}
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Importar</span>
          </button>
          {/* Hide toggle */}
          <button
            onMouseDown={(e) => { e.preventDefault(); toggleHide() }}
            title={contentHidden ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
            style={{ color: contentHidden ? 'var(--color-primary)' : '#6c7086' }}
          >
            {contentHidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          {/* Per-note font */}
          <div className="relative flex items-center">
            <Type size={11} className="absolute left-1.5 text-ui-muted pointer-events-none" />
            <select
              value={noteFont}
              onChange={(e) => changeNoteFont(e.target.value)}
              title="Fonte desta nota"
              className="pl-5 pr-1 py-1 rounded text-[10px] outline-none appearance-none cursor-pointer"
              style={{ background: 'rgba(37,37,53,0.5)', color: '#a6adc8', border: '1px solid #313244', fontFamily: `'${noteFont}', sans-serif` }}
            >
              {NOTE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
            </select>
          </div>

          {/* Diagram Tools */}
          <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#313244' }} />
          <div className="flex items-center gap-0.5 bg-[#181825]/60 rounded-lg p-0.5 border border-[#313244]/50 shadow-inner">
            <button
              onClick={insertDiagram}
              title="Inserir Diagrama (Excalidraw)"
              className="p-1.5 rounded-md hover:bg-ui-hover text-[#cba6f7] transition-all hover:scale-110 active:scale-95"
            >
              <Workflow size={14} />
            </button>
            <div className="w-px h-4 bg-[#313244] mx-1" />
            {[
              { id: 'select', icon: MousePointer2, title: 'Selecionar (V)' },
              { id: 'rect',   icon: Square,        title: 'Retângulo (R)' },
              { id: 'arrow',  icon: ArrowUpRight,  title: 'Seta de Conexão (S)' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveDiagramTool(tool.id)}
                title={tool.title}
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  activeDiagramTool === tool.id 
                    ? 'bg-[#cba6f7]/20 text-[#cba6f7] shadow-[0_0_10px_rgba(203,166,247,0.2)]' 
                    : 'text-ui-muted hover:text-ui-text hover:bg-ui-hover'
                }`}
              >
                <tool.icon size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      {contentHidden ? (
        <div className="flex-1 flex items-center justify-center" style={{ background: 'rgba(14,14,26,0.4)' }}>
          <div className="text-center text-ui-muted">
            <EyeOff size={32} className="mx-auto mb-3 opacity-20" />
            <div className="text-sm opacity-40">Conteúdo oculto</div>
            <button
              onClick={toggleHide}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ background: 'var(--color-primary)', color: '#1e1e2e' }}
            >
              Mostrar conteúdo
            </button>
          </div>
        </div>
      ) : (
      <div id="editor-content-area" className="flex flex-1 overflow-hidden relative">
        {/* Editor */}
        {showEditor && (
          <div
            className="flex flex-col overflow-hidden relative"
            style={{ width: `${editorPct}%`, flexShrink: 0 }}
          >
            <textarea
              ref={textareaRef}
              className="editor-textarea flex-1"
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder="Escreva em Markdown..."
              style={{ background: 'transparent', fontFamily: `'${noteFont}', sans-serif` }}
            />

            {/* Wiki autocomplete dropdown */}
            {wikiSuggest && wikiSuggest.items.length > 0 && (
              <div
                ref={suggestRef}
                className="absolute left-4 bottom-4 z-50 rounded-lg overflow-hidden shadow-2xl fade-in"
                style={{
                  background: 'rgba(25,25,40,0.98)',
                  border: '1px solid #45475a',
                  minWidth: 220,
                  maxWidth: 320,
                }}
              >
                <div className="px-3 py-1.5 text-ui-muted text-xs flex items-center gap-1.5"
                  style={{ borderBottom: '1px solid #313244' }}>
                  <Link2 size={11} />
                  <span>
                    {wikiSuggest.query
                      ? `Notas com "${wikiSuggest.query}"`
                      : 'Todas as notas'}
                  </span>
                  <span className="ml-auto opacity-50">↑↓ Enter</span>
                </div>
                {wikiSuggest.items.map((note, idx) => (
                  <button
                    key={note.id}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(note.title) }}
                    className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2"
                    style={{
                      background: idx === wikiSuggest.selectedIdx ? 'rgba(203,166,247,0.15)' : 'transparent',
                      color: idx === wikiSuggest.selectedIdx ? '#cba6f7' : '#cdd6f4',
                      borderBottom: idx < wikiSuggest.items.length - 1 ? '1px solid #1e1e2e' : 'none',
                    }}
                  >
                    <span className="text-ui-muted text-xs">⬡</span>
                    <span className="truncate">{note.title}</span>
                  </button>
                ))}
                {wikiSuggest.items.length === 0 && (
                  <div className="px-3 py-2 text-ui-muted text-xs">
                    Nenhuma nota encontrada — Enter cria uma nova
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Handle entre editor e preview */}
        {showEditor && showPreview && (
          <ResizeHandle onDragStart={(e) => startPanelDrag(
            (mode === 'graph' || mode === 'chat') ? 'tri-left' : 'split', e
          )} />
        )}

        {/* Preview */}
        {showPreview && (
          <div
            className="overflow-hidden"
            style={{ width: `${previewPct}%`, flexShrink: 0 }}
          >
            <MarkdownPreview
              content={previewContent}
              activeTool={activeDiagramTool}
              onDiagramUpdate={handleDiagramUpdate}
            />
          </div>
        )}

        {/* Handle entre preview e terceiro painel */}
        {showPreview && (showGraph || showChat) && (
          <ResizeHandle onDragStart={(e) => startPanelDrag('tri-mid', e)} />
        )}

        {/* Grafo */}
        {showGraph && (
          <div className="h-full overflow-hidden" style={{ width: mode === 'graph-full' ? '100%' : `${thirdPct}%`, flexShrink: 0 }}>
            <InlineGraph />
          </div>
        )}

        {/* Chat */}
        {showChat && (
          <div className="h-full overflow-hidden border-l border-[#313244]" style={{ width: `${thirdPct}%`, flexShrink: 0 }}>
            <ChatPanel />
          </div>
        )}

      </div>
      )}

      {/* ── Status bar ── */}
      {(() => {
        const wordCount = previewContent.trim()
          ? previewContent.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~[\]]/g, '').trim().split(/\s+/).filter(Boolean).length
          : 0
        const charCount = previewContent.length
        return (
          <div className="flex items-center gap-3 px-4 py-1 flex-shrink-0 select-none"
            style={{ borderTop: '1px solid #1e1e2e', background: 'rgba(14,14,26,0.7)' }}>
            <span className="text-[10px] text-ui-muted">{wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}</span>
            <span className="text-[10px]" style={{ color: '#313244' }}>·</span>
            <span className="text-[10px] text-ui-muted">{charCount} {charCount === 1 ? 'caractere' : 'caracteres'}</span>
          </div>
        )
      })()}

      <BacklinksPanel noteId={activeNote.id} />

      {showBalloons && <BalloonOverlay onDone={() => setShowBalloons(false)} />}
    </div>
  )
}

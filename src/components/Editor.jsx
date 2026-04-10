import React, { useState, useRef, useEffect, useCallback } from 'react'
import { EyeOff } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { encryptText } from '../crypto'
import { dbUpdateNote } from '../db/database'
import { getWikiQuery } from '../utils/markdownUtils'
import { getLanguageMetadata } from '../utils/languageUtils'

// Sub-components
import MarkdownPreview from './MarkdownPreview'
import BacklinksPanel from './BacklinksPanel'
import InlineGraph from './InlineGraph'
import ChatPanel from './ChatPanel'
import DiagramView from './DiagramView'
import VimEditor from './VimEditor'
import { BalloonOverlay } from './common/BalloonOverlay'
import { EditorTabs } from './editor/EditorTabs'
import { EditorHeader } from './editor/EditorHeader'
import { EditorToolbar } from './editor/EditorToolbar'
import { WikiSuggest } from './editor/WikiSuggest'
import { SpeechBrain } from './SpeechBrain'

const noteFontKey = (id) => `personal-brain-note-font-${id}`
const noteHideKey = (id) => `personal-brain-hidden-${id}`

export default function Editor({ onImport, showNotification, revealInExplorer }) {
  const { 
    getActiveNote, updateNote, notes, openTabs, 
    closeTab, setActiveNote, activeNoteId, settings,
    user, exportNotesAsMd, folders
  } = useNotesStore()
  
  const activeNote = getActiveNote()
  const vimMode = settings?.extra?.vimMode || false

  const [mode, setMode] = useState('split')
  const [previewContent, setPreviewContent] = useState('')
  const [contentHidden, setContentHidden] = useState(false)
  const [noteFont, setNoteFont] = useState('Inter')
  const [showSpeech, setShowSpeech] = useState(false)
  
  const { extension: langExt, isMarkdown } = getLanguageMetadata(activeNote?.title)
  
  const textareaRef = useRef(null)
  const vimEditorRef = useRef(null)
  const lastNoteId  = useRef(null)
  const saveTimeout = useRef(null)

  // ── Sync Logic ────────────────────────────────────────────────────────────
  // Reset so sync re-runs when toggling vim mode (textarea remounts fresh)
  useEffect(() => { lastNoteId.current = null }, [vimMode])

  useEffect(() => {
    if (!activeNote) return
    const val = activeNote.content || ''
    if (activeNote.id !== lastNoteId.current) {
      lastNoteId.current = activeNote.id
      if (textareaRef.current) textareaRef.current.value = val
      setPreviewContent(val)
      setContentHidden(localStorage.getItem(noteHideKey(activeNote.id)) === '1')
      setNoteFont(localStorage.getItem(noteFontKey(activeNote.id)) || 'Inter')
    } else if (textareaRef.current && textareaRef.current.value !== val) {
      // If note didn't change but mode did (remount), sync value if different
      textareaRef.current.value = val
      setPreviewContent(val)
    }
  }, [activeNote?.id, activeNote?.content, vimMode, mode])

  // ── AI State ─────────────────────────────────────────────────────────────
  const [aiStatus, setAiStatus]     = useState(null)
  const [aiProgress, setAiProgress] = useState({ chunk: 0, total: 0 })
  const [aiTranslate, setAiTranslate] = useState(false)
  const [showBalloons, setShowBalloons] = useState(false)
  const [activeDiagramTool, setActiveDiagramTool] = useState('select')
  const aiAbortRef = useRef(null)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta    = e.target
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const spaces = '    '
    ta.value = ta.value.slice(0, start) + spaces + ta.value.slice(end)
    ta.selectionStart = ta.selectionEnd = start + spaces.length
    handleChange({ target: ta })
  }

  const handleChange = (e) => {
    const content = e.target.value
    const cursor  = e.target.selectionStart
    setPreviewContent(content)

    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content })
    }, 600)

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

  const [wikiSuggest, setWikiSuggest] = useState(null)

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

  const handleAiFormat = useCallback(async () => {
    const ta = textareaRef.current
    if (!ta || !activeNote) return

    const selStart = ta.selectionStart
    const selEnd   = ta.selectionEnd
    const hasSelection = selStart !== selEnd
    const ai_model = settings.extra?.aiModel || 'gemma3:12b'

    const confirmed = window.confirm(
      `✨ Formatar ${hasSelection ? 'trecho selecionado' : 'nota completa'} com IA (${ai_model})?` +
      `${aiTranslate ? '\n🌐 Tradução para português ativada.' : ''}`
    )
    if (!confirmed) return

    const fullText      = ta.value
    const contentToSend = hasSelection ? fullText.slice(selStart, selEnd) : fullText

    setAiStatus('formatting')
    setAiProgress({ chunk: 0, total: 0 })
    const controller = new AbortController()
    aiAbortRef.current = controller

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
          content: contentToSend,
          title: activeNote.title,
          notes: notes.filter(n => n.id !== activeNote.id).map(n => ({ id: n.id, title: n.title })),
          translate: aiTranslate,
          ai_model: ai_model,
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
            } else if (evt.type === 'partial') {
              applyContent(evt.content)
              setAiProgress({ chunk: evt.chunk, total: evt.total })
            } else if (evt.type === 'done') {
              const newVal = applyContent(evt.content)
              updateNote(activeNote.id, { content: newVal })
              setAiStatus('done')
              setShowBalloons(true)
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') alert(`Erro na formatação IA: ${err.message}`)
    } finally {
      aiAbortRef.current = null
      setAiStatus(null)
    }
  }, [activeNote, notes, updateNote, aiTranslate, settings.extra?.aiModel])

  const insertText = (before, after = '', block = false) => {
    if (vimMode) {
      vimEditorRef.current?.insertText(before + after)
      return
    }
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    const start = ta.selectionStart
    const val   = ta.value
    if (block) {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      ta.setSelectionRange(lineStart, lineStart)
      document.execCommand('insertText', false, before)
    } else {
      const selected = val.slice(start, ta.selectionEnd)
      document.execCommand('insertText', false, before + selected + after)
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

  const [interimSpeech, setInterimSpeech] = useState('')

  const handleSpeechTranscript = ({ final, interim }) => {
    if (!activeNote) return
    
    let baseContent = previewContent
    if (final) {
        baseContent += final
        setPreviewContent(baseContent)
        if (textareaRef.current) textareaRef.current.value = baseContent
        clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
          updateNote(activeNote.id, { content: baseContent })
        }, 500)
    }
    
    setInterimSpeech(interim || '')
  }

  const toggleHide = () => {
    const next = !contentHidden
    localStorage.setItem(noteHideKey(activeNote.id), next ? '1' : '0')
    setContentHidden(next)
  }

  const changeNoteFont = (f) => {
    setNoteFont(f)
    localStorage.setItem(noteFontKey(activeNote.id), f)
  }

  const handleExport = async () => {
    try {
      const r = await exportNotesAsMd([activeNote], folders)
      const targetPath = r.filePath || r.memoryFile || r.path
      showNotification('✅ Nota exportada com sucesso!', 'success', () => revealInExplorer(targetPath), 'Abrir na Pasta')
    } catch (e) {
      showNotification('Erro ao exportar: ' + e.message, 'error')
    }
  }

  const insertDiagram = () => {
    const defaultData = JSON.stringify({ _id: `diag-${Date.now()}`, nodes: [], edges: [] }, null, 2)
    const block = `\n\`\`\`diagram\n${defaultData}\n\`\`\`\n`
    insertText(block)
    setMode('split')
  }

  // ── Resizable Logic ───────────────────────────────────────────────────────
  const [splitLeft, setSplitLeft] = useState(50)
  const [triLeft, setTriLeft] = useState(33)
  const [triMid, setTriMid] = useState(33)
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
        const diff = newLeft - panelDrag.current.startVal
        setTriLeft(newLeft)
        setTriMid(Math.max(10, Math.min(80, panelDrag.current.startVal2 - diff)))
      } else if (panelDrag.current.type === 'tri-mid') {
        setTriMid(Math.max(10, Math.min(80, panelDrag.current.startVal + deltaPct)))
      }
    }
    const onUp = () => { panelDrag.current = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Ctrl+W → close active tab; Ctrl+F4 → prevent app close; Ctrl+Tab → next tab
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeNoteId) closeTab(activeNoteId)
      }
      if (e.ctrlKey && e.key === 'F4') {
        e.preventDefault()
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        if (openTabs.length < 2) return
        const idx = openTabs.indexOf(activeNoteId)
        const next = e.shiftKey
          ? openTabs[(idx - 1 + openTabs.length) % openTabs.length]
          : openTabs[(idx + 1) % openTabs.length]
        setActiveNote(next)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeNoteId, closeTab, openTabs, setActiveNote])

  const startPanelDrag = (type, e) => {
    e.preventDefault()
    panelDrag.current = { type, startX: e.clientX, startVal: type === 'split' ? splitLeft : type === 'tri-left' ? triLeft : triMid, startVal2: triMid }
    document.body.style.cursor = 'col-resize'
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (!activeNote || openTabs.length === 0) {
    const homeNote = notes.find(n => n.title === '🚀 Últimas Novidades')
    return (
      <div className="flex flex-col h-full bg-[#0e0e1a]/40">
        <EditorTabs openTabs={openTabs} activeNoteId={activeNoteId} notes={notes} setActiveNote={setActiveNote} closeTab={closeTab} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-ui-muted">
            <div className="text-5xl mb-4 opacity-30">⬡</div>
            <div className="text-sm mb-2">Selecione uma nota para abrir</div>
            {homeNote && (
              <button onClick={() => setActiveNote(homeNote.id)} className="mt-2 px-4 py-2 rounded-lg text-xs font-medium bg-ui-accent text-[#1e1e2e]">
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
  
  const editorPct  = mode === 'edit' ? 100 : mode === 'preview' ? 0 : (mode === 'graph' || mode === 'chat') ? triLeft : splitLeft
  const previewPct = mode === 'preview' ? 100 : mode === 'edit' ? 0 : (mode === 'graph' || mode === 'chat') ? triMid : (100 - splitLeft)

  return (
    <div className="flex flex-col h-full bg-[#0e0e1a]/40 text-ui-text">
      <EditorTabs openTabs={openTabs} activeNoteId={activeNoteId} notes={notes} setActiveNote={setActiveNote} closeTab={closeTab} />
      
      <EditorHeader
        activeNote={activeNote}
        mode={mode}
        setMode={setMode}
      />

      {showEditor && (
        <EditorToolbar
          onInsert={insertText}
          onImport={onImport}
          onExport={handleExport}
          onAiFormat={handleAiFormat}
          onToggleHide={toggleHide}
          onToggleSpeech={() => setShowSpeech(true)}
          aiStatus={aiStatus}
          aiProgress={aiProgress}
          aiTranslate={aiTranslate}
          setAiTranslate={setAiTranslate}
          onCancelAi={() => aiAbortRef.current?.abort()}
          contentHidden={contentHidden}
          noteFont={noteFont}
          onNoteFontChange={changeNoteFont}
          onInsertDiagram={insertDiagram}
          activeDiagramTool={activeDiagramTool}
          setActiveDiagramTool={setActiveDiagramTool}
        />
      )}

      {contentHidden ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-ui-muted opacity-40">
            <EyeOff size={32} className="mx-auto mb-3" />
            <button onClick={toggleHide} className="mt-4 px-4 py-2 rounded-lg text-xs font-medium bg-ui-accent text-[#1e1e2e] opacity-100">Mostrar conteúdo</button>
          </div>
        </div>
      ) : (
        <div id="editor-content-area" className="flex flex-1 overflow-hidden relative">
          {showEditor && (
            <div className="flex flex-col overflow-hidden relative" style={{ width: `${editorPct}%`, flexShrink: 0 }}>
              {vimMode ? (
                <VimEditor
                  ref={vimEditorRef}
                  key={activeNote.id}
                  value={previewContent}
                  font={noteFont}
                  vimrc={settings?.extra?.vimrc || ''}
                  language={langExt}
                  onCloseTab={() => closeTab(activeNoteId)}
                  onChange={(val) => { setPreviewContent(val); if (activeNote) updateNote(activeNote.id, { content: val }) }}
                  onSave={(val) => { if (activeNote) updateNote(activeNote.id, { content: val }) }}
                />
              ) : (
                <textarea
                  ref={textareaRef}
                  className="editor-textarea flex-1 p-6"
                  defaultValue={previewContent}
                  onChange={handleChange}
                  onKeyDown={handleTabKey}
                  spellCheck={false}
                  style={{ background: 'transparent', fontFamily: `'${noteFont}', sans-serif` }}
                />
              )}
              <WikiSuggest suggest={wikiSuggest} onApply={applySuggestion} />
            </div>
          )}

          {showEditor && showPreview && (
            <div onMouseDown={(e) => startPanelDrag(mode === 'split' ? 'split' : 'tri-left', e)} 
              className="w-1 cursor-col-resize bg-[#313244] hover:bg-ui-accent transition-colors z-10" />
          )}

          {showPreview && (
            <div className="flex flex-col overflow-hidden relative" style={{ width: `${previewPct}%`, flexShrink: 0 }}>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <MarkdownPreview 
                  content={previewContent + (interimSpeech ? ` _${interimSpeech}_` : '')} 
                  filename={activeNote?.title}
                  onDiagramUpdate={(oldJ, newJ) => {
                  const newVal = previewContent.replace(oldJ, newJ)
                  setPreviewContent(newVal)
                  if (activeNote) updateNote(activeNote.id, { content: newVal })
                }} activeTool={activeDiagramTool} />
                <BacklinksPanel noteTitle={activeNote.title} notes={notes} onSelect={setActiveNote} />
              </div>
            </div>
          )}

          {(mode === 'graph' || mode === 'chat') && (
            <div onMouseDown={(e) => startPanelDrag('tri-mid', e)} 
              className="w-1 cursor-col-resize bg-[#313244] hover:bg-ui-accent transition-colors z-10" />
          )}

          {mode === 'graph' && (
            <div className="flex-1 bg-[#1e1e2e]/50"><InlineGraph notes={notes} activeNoteId={activeNoteId} onSelect={setActiveNote} /></div>
          )}
          {mode === 'chat' && (
            <div className="flex-1 bg-[#1e1e2e]/50 border-l border-[#313244]"><ChatPanel activeNote={activeNote} notes={notes} /></div>
          )}
          {mode === 'graph-full' && (
            <div className="absolute inset-0 z-40 bg-[#1e1e2e]"><InlineGraph notes={notes} activeNoteId={activeNoteId} onSelect={setActiveNote} fullScreen /></div>
          )}
        </div>
      )}

      {showBalloons && <BalloonOverlay onDone={() => setShowBalloons(false)} />}
      {showSpeech && <SpeechBrain onTranscript={handleSpeechTranscript} onClose={() => setShowSpeech(false)} />}
    </div>
  )
}

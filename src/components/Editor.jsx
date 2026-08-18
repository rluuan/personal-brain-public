import React, { useState, useRef, useEffect, useCallback } from 'react'
import { EyeOff } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { getWikiQuery } from '../utils/markdownUtils'
import { getLanguageMetadata } from '../utils/languageUtils'

// Sub-components
import MarkdownPreview from './MarkdownPreview'
import BacklinksPanel from './BacklinksPanel'
import InlineGraph from './InlineGraph'
import ChatPanel from './ChatPanel'
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

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('editor-mode')
    return saved === 'split' || saved === 'preview' ? 'edit' : (saved || 'edit')
  })
  const [previewContent, setPreviewContent] = useState('') // unfolded — feeds MarkdownPreview (graph/chat modes)
  const [editorValue, setEditorValue] = useState('')        // folded (diagrams/images collapsed) — feeds the live editor
  const [contentHidden, setContentHidden] = useState(false)
  const [noteFont, setNoteFont] = useState('Inter')
  const [showSpeech, setShowSpeech] = useState(false)

  const { extension: langExt, isMarkdown } = getLanguageMetadata(activeNote?.title)

  const vimEditorRef = useRef(null)
  const lastNoteId  = useRef(null)
  const saveTimeout = useRef(null)
  // Tracks latest (unfolded) content without triggering re-renders (used by diagram saves)
  const latestContentRef = useRef('')

  useEffect(() => { localStorage.setItem('editor-mode', mode) }, [mode])

  // ── Sync Logic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeNote) return
    const val = activeNote.content || ''
    if (activeNote.id !== lastNoteId.current) {
      lastNoteId.current = activeNote.id
      latestContentRef.current = val
      setPreviewContent(val)
      setEditorValue(collapseImages(collapseAllDiagrams(val)))
      setContentHidden(localStorage.getItem(noteHideKey(activeNote.id)) === '1')
      setNoteFont(localStorage.getItem(noteFontKey(activeNote.id)) || 'Inter')
    } else if (latestContentRef.current !== val) {
      latestContentRef.current = val
      setPreviewContent(val)
      setEditorValue(collapseImages(collapseAllDiagrams(val)))
    }
  }, [activeNote?.id, activeNote?.content])

  // ── Diagram fold helpers ─────────────────────────────────────────────────
  const foldedDiagramsRef = useRef(new Map()) // id → originalBlock

  const FOLD_PLACEHOLDER = (id) => `\`\`\`diagram:collapsed:${id}\`\`\``

  // Returns display value of content with all diagram blocks collapsed
  const collapseAllDiagrams = useCallback((raw) => {
    const map = new Map()
    const display = raw.replace(/```diagram\n(\{[\s\S]*?\})\n```/g, (match, jsonStr) => {
      try {
        const id = JSON.parse(jsonStr)._id
        if (id) { map.set(id, match); return FOLD_PLACEHOLDER(id) }
      } catch {}
      return match
    })
    foldedDiagramsRef.current = map
    return display
  }, [])

  // Restores diagram/image placeholders back to their real content
  const expandFolds = useCallback((content) => {
    let out = content
    for (const [id, originalBlock] of foldedDiagramsRef.current) {
      out = out.replace(FOLD_PLACEHOLDER(id), originalBlock)
    }
    for (const [altId, dataUrl] of foldedImagesRef.current) {
      out = out.replace(IMAGE_PLACEHOLDER(altId), `![${altId}](${dataUrl})`)
    }
    return out
  }, [])

  // Expand a single collapsed diagram in the editor
  const expandDiagram = useCallback((id) => {
    const original = foldedDiagramsRef.current.get(id)
    if (!original) return
    const currentFolded = vimEditorRef.current?.getCursorAndDoc()?.doc ?? ''
    const newVal = currentFolded.replace(FOLD_PLACEHOLDER(id), original)
    foldedDiagramsRef.current.delete(id)
    setEditorValue(newVal)
    latestContentRef.current = expandFolds(newVal)
  }, [expandFolds])

  // ── AI State ─────────────────────────────────────────────────────────────
  const [aiStatus, setAiStatus]     = useState(null)
  const [aiProgress, setAiProgress] = useState({ chunk: 0, total: 0 })
  const [aiTranslate, setAiTranslate] = useState(false)
  const [showBalloons, setShowBalloons] = useState(false)
  const aiAbortRef = useRef(null)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEditorChange = (rawContent) => {
    const content = expandFolds(rawContent)
    latestContentRef.current = content
    setPreviewContent(content)
    // Mantém editorValue em dia — se o editor remontar (troca de vim mode/fonte), o valor inicial precisa ser o atual, não o do último load da nota
    setEditorValue(rawContent)

    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content })
    }, 600)

    const info = vimEditorRef.current?.getCursorAndDoc()
    if (!info) return
    const query = getWikiQuery(info.doc, info.cursor)
    if (query !== null) {
      const q = query.toLowerCase()
      const items = notes
        .filter((n) => n.id !== activeNote?.id && n.title.toLowerCase().includes(q))
        .slice(0, 6)
      const coords = vimEditorRef.current?.getCursorPosition?.() || {}
      setWikiSuggest({ query, items, selectedIdx: 0, ...coords })
    } else {
      setWikiSuggest(null)
    }
  }

  const [wikiSuggest, setWikiSuggest] = useState(null)

  const applySuggestion = (title) => {
    setWikiSuggest(null)
    vimEditorRef.current?.replaceWikiText(title)
  }

  const handleAiFormat = useCallback(async () => {
    if (!activeNote) return
    const info = vimEditorRef.current?.getCursorAndDoc()
    if (!info) return

    try {
      const statusRes = await fetch(`http://${window.location.hostname}:3001/api/ollama/status`)
      const statusData = await statusRes.json()
      if (!statusData.ok) {
        showNotification('🤖 Ollama não encontrado. Instale em ollama.com e rode: ollama pull gemma3:12b', 'error')
        return
      }
    } catch {
      showNotification('🤖 Ollama não encontrado. Instale em ollama.com e rode: ollama pull gemma3:12b', 'error')
      return
    }

    const { doc: foldedText, selFrom, selTo } = info
    const hasSelection = selFrom !== selTo
    const ai_model = settings.extra?.aiModel || 'gemma3:12b'

    const confirmed = window.confirm(
      `✨ Formatar ${hasSelection ? 'trecho selecionado' : 'nota completa'} com IA (${ai_model})?` +
      `${aiTranslate ? '\n🌐 Tradução para português ativada.' : ''}`
    )
    if (!confirmed) return

    // AI sempre opera em texto sem placeholders de diagrama/imagem
    const contentToSend = hasSelection ? expandFolds(foldedText.slice(selFrom, selTo)) : latestContentRef.current

    setAiStatus('formatting')
    setAiProgress({ chunk: 0, total: 0 })
    const controller = new AbortController()
    aiAbortRef.current = controller

    const applyContent = (formatted) => {
      const newFolded = hasSelection
        ? foldedText.slice(0, selFrom) + formatted + foldedText.slice(selTo)
        : formatted
      setEditorValue(newFolded)
      const expanded = expandFolds(newFolded)
      latestContentRef.current = expanded
      setPreviewContent(expanded)
      return expanded
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
  }, [activeNote, notes, updateNote, aiTranslate, settings.extra?.aiModel, expandFolds])

  const insertText = (before, after = '', block = false) => {
    vimEditorRef.current?.insertFormatting(before, after, block)
  }

  const [interimSpeech, setInterimSpeech] = useState('')

  const handleSpeechTranscript = ({ final, interim }) => {
    if (!activeNote) return

    if (final) {
        const baseContent = previewContent + final
        setPreviewContent(baseContent)
        setEditorValue(collapseImages(collapseAllDiagrams(baseContent)))
        latestContentRef.current = baseContent
        clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
          updateNote(activeNote.id, { content: baseContent })
        }, 500)
    }

    setInterimSpeech(interim || '')
  }

  // ── Wiki suggest refs ─────────────────────────────────────────────────────
  const wikiSuggestRef    = useRef(null)
  const wikiKeyHandlerRef = useRef(null)

  // Keeps wikiSuggestRef in sync so the key handler sees latest state
  useEffect(() => { wikiSuggestRef.current = wikiSuggest }, [wikiSuggest])

  // Set once — checked by VimEditor's internal keymap
  useEffect(() => {
    wikiKeyHandlerRef.current = (key) => {
      const ws = wikiSuggestRef.current
      if (!ws || ws.items.length === 0) return false
      if (key === 'ArrowDown') { setWikiSuggest(prev => ({ ...prev, selectedIdx: (prev.selectedIdx + 1) % prev.items.length })); return true }
      if (key === 'ArrowUp')   { setWikiSuggest(prev => ({ ...prev, selectedIdx: (prev.selectedIdx - 1 + prev.items.length) % prev.items.length })); return true }
      if (key === 'Enter')     { const item = ws.items[ws.selectedIdx]; if (item) applySuggestion(item.title); return true }
      if (key === 'Escape')    { setWikiSuggest(null); return true }
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image fold helpers ─────────────────────────────────────────────────────
  const foldedImagesRef = useRef(new Map())
  const IMAGE_PLACEHOLDER = (altId) => `![${altId}](img:collapsed)`

  const collapseImages = useCallback((raw) => {
    const map = new Map()
    const display = raw.replace(/!\[([^\]]*)\]\((data:[^)]+)\)/g, (_, alt, dataUrl) => {
      const key = alt || 'img'
      map.set(key, dataUrl)
      return IMAGE_PLACEHOLDER(key)
    })
    foldedImagesRef.current = map
    return display
  }, [])

  const imageInputRef = useRef(null)

  const handleInsertImage = () => {
    imageInputRef.current?.click()
  }

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const altId = `img-${Date.now()}`
    const ext = file.name.split('.').pop() || 'jpg'
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      let finalUrl = dataUrl // fallback inline

      try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl, filename: `${altId}.${ext}` }),
        })
        if (res.ok) {
          const { url } = await res.json()
          finalUrl = `http://${window.location.hostname}:3001${url}`
        }
      } catch { /* usa dataUrl inline */ }

      const fullMd = `\n![${altId}](${finalUrl})\n`
      const newContent = latestContentRef.current + fullMd
      latestContentRef.current = newContent
      setPreviewContent(newContent)
      vimEditorRef.current?.insertText(fullMd)

      clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        if (activeNote) updateNote(activeNote.id, { content: newContent })
      }, 300)
    }
    reader.readAsDataURL(file)
  }

  const handleImageResize = (altText, newWidth) => {
    const baseAlt = altText.replace(/\|w=\d+/, '').trim()
    const newAlt = `${baseAlt}|w=${newWidth}`
    const escaped = altText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const content = latestContentRef.current
    const newContent = content.replace(
      new RegExp(`!\\[${escaped}\\]\\(([^)]+)\\)`),
      `![${newAlt}]($1)`
    )
    latestContentRef.current = newContent
    setPreviewContent(newContent)
    setEditorValue(collapseImages(collapseAllDiagrams(newContent)))
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      if (activeNote) updateNote(activeNote.id, { content: newContent })
    }, 300)
  }

  const insertColor = (color) => {
    vimEditorRef.current?.insertFormatting('[', `]{${color}}`, false)
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
    const defaultData = JSON.stringify({ _id: `diag-${Date.now()}`, elements: [], appState: { theme: 'dark' } }, null, 2)
    const block = `\n\`\`\`diagram\n${defaultData}\n\`\`\`\n`
    insertText(block)
    // Collapse immediately after inserting so the JSON doesn't clutter the editor
    const currentFolded = vimEditorRef.current?.getCursorAndDoc()?.doc ?? ''
    setEditorValue(collapseAllDiagrams(currentFolded))
  }

  // ── Resizable Logic ───────────────────────────────────────────────────────
  const [triLeft, setTriLeft] = useState(33)
  const [triMid, setTriMid] = useState(33)
  const panelDrag = useRef(null)

  useEffect(() => {
    const onMove = (e) => {
      if (!panelDrag.current) return
      const dx = e.clientX - panelDrag.current.startX
      const containerW = document.getElementById('editor-content-area')?.offsetWidth || window.innerWidth
      const deltaPct = (dx / containerW) * 100
      if (panelDrag.current.type === 'tri-left') {
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
    panelDrag.current = { type, startX: e.clientX, startVal: type === 'tri-left' ? triLeft : triMid, startVal2: triMid }
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

  const showEditor  = mode === 'edit' || mode === 'graph' || mode === 'chat'
  const showPreview = mode === 'graph' || mode === 'chat'

  const editorPct  = showPreview ? triLeft : 100
  const previewPct = showPreview ? triMid : 0

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
          onToggleSpeech={() => {
            if (window.updater) {
              showNotification('🎙️ Transcrição por voz só funciona no app web (localhost:5173). No Electron, o acesso à API de fala do Google é bloqueado.', 'info')
              return
            }
            setShowSpeech(true)
          }}
          aiStatus={aiStatus}
          aiProgress={aiProgress}
          aiTranslate={aiTranslate}
          setAiTranslate={setAiTranslate}
          onCancelAi={() => aiAbortRef.current?.abort()}
          contentHidden={contentHidden}
          noteFont={noteFont}
          onNoteFontChange={changeNoteFont}
          onInsertDiagram={insertDiagram}
          onInsertImage={handleInsertImage}
          onInsertColor={insertColor}
        />
      )}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageFileChange}
      />

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
              <VimEditor
                ref={vimEditorRef}
                key={`${activeNote.id}-${vimMode}`}
                value={editorValue}
                vimMode={vimMode}
                font={noteFont}
                vimrc={settings?.extra?.vimrc || ''}
                language={langExt}
                wikiKeyHandlerRef={wikiKeyHandlerRef}
                onCloseTab={() => closeTab(activeNoteId)}
                onChange={handleEditorChange}
                onLineClick={(lineText) => {
                  const match = lineText.match(/^```diagram:collapsed:(.+)```$/)
                  if (match) expandDiagram(match[1])
                }}
                onSave={(val) => { if (activeNote) updateNote(activeNote.id, { content: expandFolds(val) }) }}
              />
              <WikiSuggest suggest={wikiSuggest} onApply={applySuggestion} onClose={() => setWikiSuggest(null)} />
            </div>
          )}

          {showEditor && showPreview && (
            <div onMouseDown={(e) => startPanelDrag('tri-left', e)}
              className="w-1 cursor-col-resize bg-[#313244] hover:bg-ui-accent transition-colors z-10" />
          )}

          {showPreview && (
            <div className="flex flex-col overflow-hidden relative" style={{ width: `${previewPct}%`, flexShrink: 0 }}>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <MarkdownPreview
                  content={previewContent + (interimSpeech ? ` _${interimSpeech}_` : '')}
                  filename={activeNote?.title}
                  onImageResize={handleImageResize}
                  onDiagramUpdate={(diagramId, newJson) => {
                    // Replace diagram block by _id — avoids stale codeValue after first save
                    const newVal = latestContentRef.current.replace(
                      /```diagram\n([\s\S]*?)```/g,
                      (match, jsonStr) => {
                        try { if (JSON.parse(jsonStr)._id === diagramId) return `\`\`\`diagram\n${newJson}\n\`\`\`` }
                        catch {}
                        return match
                      }
                    )
                    latestContentRef.current = newVal
                    setPreviewContent(newVal)
                    setEditorValue(collapseImages(collapseAllDiagrams(newVal)))
                    if (activeNote) updateNote(activeNote.id, { content: newVal })
                  }} />
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

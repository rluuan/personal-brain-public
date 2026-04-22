import React, { useState, useEffect, useRef } from 'react'
import {
  Heading1, Heading2, Bold, Italic, Strikethrough, Code, Link2, Hash,
  List, ListOrdered, CheckSquare, Quote, Minus, Table, Sparkles, StopCircle,
  Upload, Download, EyeOff, Eye, Type, Workflow, Mic, Image, Palette
} from 'lucide-react'

const PRESET_COLORS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1',
  '#89b4fa', '#cba6f7', '#f5c2e7', '#ffffff',
  '#a6adc8', '#6c7086',
]

function ColorPickerButton({ onInsertColor }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o) }}
        title="Cor da fonte"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
        style={{ color: '#f5c2e7' }}
      >
        <Palette size={14} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg p-2 shadow-xl"
          style={{ background: 'rgba(25,25,40,0.98)', border: '1px solid #45475a', minWidth: 130 }}
        >
          <div className="grid grid-cols-5 gap-1 mb-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); onInsertColor?.(c); setOpen(false) }}
                className="w-5 h-5 rounded hover:scale-110 transition-transform"
                style={{ background: c, border: '1px solid rgba(255,255,255,0.1)' }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-ui-hover/30">
            <input
              type="color"
              className="w-5 h-5 rounded cursor-pointer p-0"
              style={{ border: 'none', background: 'none' }}
              onChange={(e) => { onInsertColor?.(e.target.value); setOpen(false) }}
              title="Cor personalizada"
            />
            <span className="text-[10px] text-ui-muted">Personalizada</span>
          </div>
        </div>
      )}
    </div>
  )
}

export const FORMAT_GROUPS = [
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

export const NOTE_FONTS = [
  'Inter', 'Roboto', 'JetBrains Mono', 'Fira Code', 'Merriweather', 'IBM Plex Mono',
]

export function EditorToolbar({
  onInsert, onImport, onExport, onAiFormat, onToggleHide, onToggleSpeech,
  aiStatus, aiProgress, aiTranslate, setAiTranslate, onCancelAi,
  contentHidden, noteFont, onNoteFontChange,
  onInsertDiagram, onInsertImage, onInsertColor
}) {
  return (
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
              onMouseDown={(e) => { e.preventDefault(); onInsert(before, after, block) }}
              title={title}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
              style={{ color: color || '#a6adc8' }}
            >
              <Icon size={14} />
            </button>
          ))}
          {gi === 1 && <ColorPickerButton onInsertColor={onInsertColor} />}
          {gi === 3 && (
            <button
              onMouseDown={(e) => { e.preventDefault(); onInsertImage?.() }}
              title="Inserir imagem"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
              style={{ color: '#89b4fa' }}
            >
              <Image size={14} />
            </button>
          )}
        </React.Fragment>
      ))}

      {/* IA section */}
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
        onMouseDown={(e) => { e.preventDefault(); if (!aiStatus) onAiFormat() }}
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

      {aiStatus && (
        <button
          onMouseDown={(e) => { e.preventDefault(); onCancelAi() }}
          title="Cancelar processamento da IA"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
          style={{ color: '#f38ba8' }}
        >
          <StopCircle size={13} />
          <span className="hidden sm:inline">Parar</span>
        </button>
      )}

      <button
        onMouseDown={(e) => { e.preventDefault(); onToggleSpeech?.() }}
        title="Transcrição por voz (Cérebro)"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs hover:bg-ui-hover transition-all"
        style={{ color: '#cba6f7' }}
      >
        <Mic size={14} />
        <span className="hidden sm:inline">Voz</span>
      </button>

      {/* Auxiliary actions */}
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
      <button
        onMouseDown={(e) => { e.preventDefault(); onExport?.() }}
        title="Exportar esta nota como Markdown"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs hover:bg-ui-hover transition-all"
        style={{ color: 'var(--color-secondary)' }}
      >
        <Download size={14} />
        <span className="hidden sm:inline">Exportar</span>
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); onToggleHide() }}
        title={contentHidden ? 'Mostrar conteúdo' : 'Ocultar conteúdo'}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all hover:bg-ui-hover"
        style={{ color: contentHidden ? 'var(--color-primary)' : '#6c7086' }}
      >
        {contentHidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>

      {/* Font selection */}
      <div className="relative flex items-center">
        <Type size={11} className="absolute left-1.5 text-ui-muted pointer-events-none" />
        <select
          value={noteFont}
          onChange={(e) => onNoteFontChange(e.target.value)}
          title="Fonte desta nota"
          className="pl-5 pr-1 py-1 rounded text-[10px] outline-none appearance-none cursor-pointer"
          style={{ background: 'rgba(37,37,53,0.5)', color: '#a6adc8', border: '1px solid #313244', fontFamily: `'${noteFont}', sans-serif` }}
        >
          {NOTE_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>)}
        </select>
      </div>

      {/* Diagram */}
      <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: '#313244' }} />
      <button
        onClick={onInsertDiagram}
        title="Inserir Diagrama (Excalidraw)"
        className="p-1.5 rounded-md hover:bg-ui-hover text-[#cba6f7] transition-all hover:scale-110 active:scale-95"
      >
        <Workflow size={14} />
      </button>
    </div>
  )
}

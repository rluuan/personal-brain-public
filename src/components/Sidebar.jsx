import React, { useState, useEffect, useRef } from 'react'
import {
  FilePlus, Search, FolderPlus, ChevronDown, ChevronRight,
  Folder, FolderOpen, FileText, Trash2, Edit2,
  Hash, LogOut, User, RefreshCw, Settings, Upload,
  Globe, Download, Loader2, X, Link, EyeOff, Github,
} from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'

const API = () => `http://${window.location.hostname}:3001/api`

// ── Balloon overlay (shared with Editor) ─────────────────────────────────────

const BALLOON_EMOJIS = ['🎈', '🎉', '🎊', '🎈', '✨', '🌟']
function BalloonOverlay({ onDone }) {
  const items = Array.from({ length: 18 }, (_, i) => ({
    emoji: BALLOON_EMOJIS[i % BALLOON_EMOJIS.length],
    left: Math.random() * 95,
    size: 1.4 + Math.random() * 1.6,
    duration: 2.8 + Math.random() * 2.2,
    delay: Math.random() * 1.2,
  }))
  useEffect(() => {
    const t = setTimeout(onDone, 4500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {items.map((b, i) => (
        <span key={i} className="balloon" style={{
          left: `${b.left}%`, bottom: '-8%',
          fontSize: `${b.size}rem`,
          animationDuration: `${b.duration}s`,
          animationDelay: `${b.delay}s`,
        }}>{b.emoji}</span>
      ))}
    </div>
  )
}

// ── Note Item ─────────────────────────────────────────────────────────────────

function NoteItem({ note, isActive, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(note.title)
  const isHidden = localStorage.getItem(`personal-brain-hidden-${note.id}`) === '1'
  const submit = () => { if (title.trim()) onRename(note.id, title.trim()); setEditing(false) }
  return (
    <div
      onClick={() => onSelect(note.id)}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-all ${isActive ? 'text-ui-accent' : 'text-ui-text hover:bg-ui-hover/50'}`}
      style={isActive ? { background: 'rgba(49,49,85,0.7)' } : {}}
    >
      <FileText size={12} className="flex-shrink-0 text-ui-muted" />
      {editing ? (
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={submit} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-ui-panel border border-ui-accent rounded px-1 outline-none text-ui-text" style={{ minWidth: 0 }} />
      ) : (
        <span className="flex-1 truncate">{note.title}</span>
      )}
      {isHidden && <EyeOff size={10} className="flex-shrink-0 opacity-40" title="Nota oculta" />}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="p-0.5 rounded hover:text-ui-accent transition-colors" title="Renomear"><Edit2 size={10} /></button>
        <button onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${note.title}"?`)) onDelete(note.id) }} className="p-0.5 rounded hover:text-ui-red transition-colors" title="Excluir"><Trash2 size={10} /></button>
      </div>
    </div>
  )
}

// ── Folder Item ───────────────────────────────────────────────────────────────

function FolderItem({ folder, notes, subfolders, allFolders, activeNoteId, depth = 0, store, onImport }) {
  const [open, setOpen]       = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(folder.name)
  const folderNotes = notes.filter((n) => n.folder_id === folder.id)
  const submit = () => { if (name.trim()) store.renameFolder(folder.id, name.trim()); setEditing(false) }

  return (
    <div style={{ paddingLeft: depth * 10 }}>
      <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-ui-hover/40 transition-all">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <span className="text-ui-muted flex-shrink-0">{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
          <span className="text-ui-accent flex-shrink-0">{open ? <FolderOpen size={12} /> : <Folder size={12} />}</span>
          {editing ? (
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onBlur={submit} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-ui-panel border border-ui-accent rounded px-1 outline-none text-ui-text text-xs" />
          ) : (
            <span className="text-ui-text text-xs truncate flex-1">{folder.name}</span>
          )}
          <span className="text-ui-muted text-xs">{folderNotes.length}</span>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); store.createNote('Sem Título', folder.id) }} className="p-0.5 rounded hover:text-ui-green transition-colors text-ui-muted" title="Nova nota"><FilePlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); onImport(folder.id) }} className="p-0.5 rounded hover:text-ui-blue transition-colors text-ui-muted" title="Importar"><Upload size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); store.createFolder('Nova Pasta', folder.id) }} className="p-0.5 rounded hover:text-ui-yellow transition-colors text-ui-muted" title="Nova subpasta"><FolderPlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="p-0.5 rounded hover:text-ui-accent transition-colors text-ui-muted" title="Renomear"><Edit2 size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${folder.name}"?`)) store.deleteFolder(folder.id) }} className="p-0.5 rounded hover:text-ui-red transition-colors text-ui-muted" title="Excluir"><Trash2 size={10} /></button>
        </div>
      </div>
      {open && (
        <div>
          {subfolders.map((sub) => (
            <FolderItem key={sub.id} folder={sub} notes={notes}
              subfolders={allFolders.filter((f) => f.parent_id === sub.id)}
              allFolders={allFolders} activeNoteId={activeNoteId} depth={depth + 1} store={store} onImport={onImport} />
          ))}
          {folderNotes.map((note) => (
            <div key={note.id} style={{ paddingLeft: (depth + 1) * 10 + 4 }}>
              <NoteItem note={note} isActive={note.id === activeNoteId} onSelect={store.setActiveNote} onDelete={store.deleteNote} onRename={store.renameNote} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scraper Panel ─────────────────────────────────────────────────────────────
// Flow: URL input → click → modal opens immediately → user sets title+folder
// → click Importar → scrape in background → on success: create note + balloons

function ScraperPanel({ folders, onCreate }) {
  const [open, setOpen] = useState(true)
  const [url, setUrl]   = useState('')

  // Modal state
  const [modal, setModal]       = useState(false)  // modal open?
  const [noteTitle, setNoteTitle] = useState('')
  const [folderId, setFolderId]   = useState('')
  const [scraping, setScraping]   = useState(false)
  const [error, setError]         = useState('')
  const [showBalloons, setShowBalloons] = useState(false)

  const urlDomain = (u) => {
    try { return new URL(u).hostname } catch { return u }
  }

  const openModal = () => {
    if (!url.trim()) return
    setNoteTitle(urlDomain(url))
    setFolderId('')
    setError('')
    setModal(true)
  }

  const handleImport = async () => {
    if (!url.trim() || !noteTitle.trim()) return
    setScraping(true)
    setError('')
    try {
      const res = await fetch(`${API()}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), useAI: false }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Falha ao extrair conteúdo')

      await onCreate(noteTitle.trim(), folderId || null, data.content)
      setModal(false)
      setUrl('')
      setShowBalloons(true)
    } catch (e) {
      setError('Erro: ' + e.message)
    }
    setScraping(false)
  }

  return (
    <>
      <div className="mt-0.5" style={{ borderTop: '1px solid #313244' }}>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 w-full px-2 py-2 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <Globe size={11} />
          <span>Importar URL</span>
        </button>
        {open && (
          <div className="px-2 pb-3 space-y-2">
            <div className="relative">
              <Link size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-ui-muted" />
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && openModal()}
                placeholder="https://..."
                className="w-full pl-6 pr-2 py-1.5 rounded text-xs outline-none"
                style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }} />
            </div>
            <button onClick={openModal} disabled={!url.trim()}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: url.trim() ? 'rgba(137,180,250,0.15)' : 'transparent',
                border: `1px solid ${url.trim() ? 'var(--color-secondary)' : '#45475a'}`,
                color: url.trim() ? 'var(--color-secondary)' : '#6c7086',
                cursor: !url.trim() ? 'not-allowed' : 'pointer',
              }}>
              <Download size={11} /> Importar página
            </button>
          </div>
        )}
      </div>

      {/* Modal — appears immediately on click, scraping happens after confirm */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !scraping) setModal(false) }}>
          <div className="rounded-xl shadow-2xl p-5 w-full max-w-sm fade-in" style={{ background: '#1e1e2e', border: '1px solid #313244' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-ui-text font-semibold text-sm flex items-center gap-2">
                <Globe size={14} className="text-ui-accent" />Importar página
              </h2>
              {!scraping && <button onClick={() => setModal(false)} className="p-1 rounded hover:bg-ui-hover text-ui-muted"><X size={13} /></button>}
            </div>

            <p className="text-[10px] text-ui-muted mb-3 truncate">🔗 {url}</p>

            <label className="block text-[10px] text-ui-muted uppercase mb-1">Título da nota</label>
            <input autoFocus value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
              disabled={scraping}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-3"
              style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }} />

            <label className="block text-[10px] text-ui-muted uppercase mb-1">Pasta de destino</label>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)}
              disabled={scraping}
              className="w-full px-3 py-2 rounded-lg text-xs mb-4"
              style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }}>
              <option value="">— Raiz (sem pasta) —</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            {error && <p className="text-[10px] mb-3" style={{ color: '#f38ba8' }}>{error}</p>}

            <div className="flex gap-2 justify-end">
              {!scraping && (
                <button onClick={() => setModal(false)} className="px-3 py-1.5 rounded-lg text-xs text-ui-muted" style={{ background: '#313244' }}>Cancelar</button>
              )}
              <button onClick={handleImport} disabled={scraping || !noteTitle.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'var(--color-secondary)', color: '#1e1e2e', opacity: (!noteTitle.trim() || scraping) ? 0.7 : 1 }}>
                {scraping ? <><Loader2 size={11} className="animate-spin" /> Importando...</> : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBalloons && <BalloonOverlay onDone={() => setShowBalloons(false)} />}
    </>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar({ onSearch, onSync, onSettings, onImport }) {
  const store = useNotesStore()
  const { notes, folders, activeNoteId, createNote, createFolder, getAllTags, user, logout } = store
  const [tagsOpen, setTagsOpen] = useState(false)

  const rootFolders   = folders.filter((f) => !f.parent_id)
  const uncategorized = notes.filter((n) => !n.folder_id)
  const allTags       = getAllTags()

  const handleScraperCreate = async (title, folderId, content) => {
    await store.createNote(title, folderId, content)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(18,18,30,0.4)', borderRight: '1px solid #313244' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 relative" style={{ borderBottom: '1px solid #313244' }}>
        <div className="flex items-center gap-1.5 z-10 relative">
          <span className="text-ui-accent text-sm">⬡</span>
          <span className="text-ui-accent font-semibold text-sm hidden sm:inline">{store.settings.extra?.projectName || 'Personal Brain'}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button onClick={onSync} title="Sync IA"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-ui-muted hover:text-ui-accent hover:bg-ui-hover transition-colors pointer-events-auto"
            style={{ border: '1px solid #45475a' }}>
            <RefreshCw size={11} /><span>Sync IA</span>
          </button>
        </div>
        <div className="flex gap-0.5 z-10 relative">
          <button onClick={onSearch} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors" title="Buscar (Ctrl+K)"><Search size={13} /></button>
          <button onClick={() => createFolder('Nova Pasta')} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-yellow transition-colors" title="Nova pasta"><FolderPlus size={13} /></button>
          <button onClick={() => onImport(null)} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-blue transition-colors" title="Importar (.md, .txt)"><Upload size={13} /></button>
          <button onClick={() => createNote()} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-accent transition-colors" title="Nova nota"><FilePlus size={13} /></button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1">
        {rootFolders.map((folder) => (
          <FolderItem key={folder.id} folder={folder} notes={notes}
            subfolders={folders.filter((f) => f.parent_id === folder.id)}
            allFolders={folders} activeNoteId={activeNoteId} depth={0} store={store} onImport={onImport} />
        ))}

        {uncategorized.length > 0 && (
          <div className={rootFolders.length > 0 ? 'mt-1 pt-1' : ''} style={rootFolders.length > 0 ? { borderTop: '1px solid #313244' } : {}}>
            {rootFolders.length > 0 && <div className="px-2 py-1 text-ui-muted text-xs uppercase tracking-wider">Sem pasta</div>}
            {uncategorized.map((note) => (
              <NoteItem key={note.id} note={note} isActive={note.id === activeNoteId} onSelect={store.setActiveNote} onDelete={store.deleteNote} onRename={store.renameNote} />
            ))}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #313244' }}>
            <button onClick={() => setTagsOpen(!tagsOpen)}
              className="flex items-center gap-1.5 w-full px-2 py-1 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors rounded">
              {tagsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Hash size={11} /><span>Tags ({allTags.length})</span>
            </button>
            {tagsOpen && (
              <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1">
                {allTags.map((tag) => <span key={tag} className="tag-pill text-xs">#{tag}</span>)}
              </div>
            )}
          </div>
        )}

        <ScraperPanel folders={folders} onCreate={handleScraperCreate} />
      </div>

      {/* Github Credits */}
      <div className="px-3 py-1.5 flex items-center justify-center gap-1.5" style={{ background: 'rgba(18,18,30,0.3)', borderTop: '1px solid #313244' }}>
        <a 
          href="https://github.com/rluuan" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-ui-muted hover:text-ui-accent transition-colors group"
        >
          <Github size={10} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium tracking-tight">Criado por @rluuan</span>
        </a>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0 gap-2"
        style={{ borderTop: '1px solid #313244', background: 'rgba(18,18,30,0.6)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary)', color: '#1e1e2e' }}>
            <User size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ui-text truncate">{user?.nickname}</div>
            <div className="text-[10px] text-ui-muted">{notes.length} nota{notes.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onSettings} className="p-1.5 rounded hover:bg-ui-hover hover:text-ui-accent transition-colors text-ui-muted" title="Configurações">
            <Settings size={15} />
          </button>
          <button onClick={() => { if (confirm(`Sair do ${store.settings.extra?.projectName || 'Personal Brain'}?`)) logout() }}
            className="p-1.5 rounded hover:bg-ui-hover hover:text-ui-red transition-colors text-ui-muted" title="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

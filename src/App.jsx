import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, BookOpen, Search,
  Plus, Settings, Upload, X,
} from 'lucide-react'
import ParticleBackground from './components/ParticleBackground'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import SearchModal from './components/SearchModal'
import NicknameModal from './components/NicknameModal'
import KeyModal from './components/KeyModal'
import SyncModal from './components/SyncModal'
import SettingsModal from './components/SettingsModal'
import ScreenkeyOverlay from './components/ScreenkeyOverlay'
import LiveMemoryHistory from './components/LiveMemoryHistory'
import { useNotesStore } from './store/useNotesStore'
import { Notification } from './components/common/Notification'
import { isEncrypted } from './crypto'

// ── New Note Modal ────────────────────────────────────────────────────────────
function NewNoteModal({ onClose, onCreate }) {
  const { folders } = useNotesStore()
  const [title, setTitle]     = useState('Sem Título')
  const [folderId, setFolderId] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const handleCreate = async () => {
    const t = title.trim() || 'Sem Título'
    await onCreate(t, folderId || null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl p-6 w-full max-w-sm fade-in"
        style={{ background: '#1e1e2e', border: '1px solid #313244' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ui-text font-semibold text-sm">Nova Nota</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-ui-hover text-ui-muted">
            <X size={13} />
          </button>
        </div>

        <label className="block text-xs text-ui-muted mb-1">Nome da nota</label>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose() }}
          className="w-full px-3 py-2 rounded-lg text-xs outline-none mb-4"
          style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }}
        />

        <label className="block text-xs text-ui-muted mb-1">Pasta (opcional)</label>
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="w-full mb-5 px-3 py-2 rounded-lg text-sm"
          style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }}
        >
          <option value="">— Raiz (sem pasta) —</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-ui-muted hover:text-ui-text transition-colors"
            style={{ background: '#252535' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--color-primary)', color: '#1e1e2e' }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ defaultFolderId, onClose }) {
  const { folders, createNote } = useNotesStore()
  const fileInputRef = useRef(null)
  const [files, setFiles]       = useState([])
  const [folderId, setFolderId] = useState(defaultFolderId || '')
  const [importing, setImporting] = useState(false)

  // Open file picker immediately when modal appears
  useEffect(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFiles = (e) => {
    const selected = [...e.target.files]
    if (!selected.length) { onClose(); return }
    setFiles(selected)
    e.target.value = ''
  }

  const confirmImport = async () => {
    if (!files.length) return
    setImporting(true)
    for (const file of files) {
      const content = await file.text()
      const title   = file.name.replace(/\.(md|txt|text)$/i, '')
      await createNote(title, folderId || null, content)
    }
    setImporting(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Hidden file input — clicked on mount */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,.txt,.text"
        className="hidden"
        onChange={handleFiles}
      />

      {files.length > 0 && (
        <div
          className="rounded-xl shadow-2xl p-6 w-full max-w-md fade-in"
          style={{ background: '#1e1e2e', border: '1px solid #313244' }}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-ui-text font-semibold text-sm">Importar arquivos</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-ui-hover text-ui-muted">
              <X size={13} />
            </button>
          </div>
          <p className="text-ui-muted text-xs mb-4">{files.length} arquivo(s) selecionado(s)</p>

          <ul className="mb-4 max-h-40 overflow-y-auto space-y-1">
            {files.map((f, i) => (
              <li key={i} className="text-xs text-ui-text flex items-center gap-2 px-2 py-1 rounded" style={{ background: '#252535' }}>
                <span className="text-ui-accent">⬡</span>
                <span className="truncate">{f.name}</span>
              </li>
            ))}
          </ul>

          <label className="block text-xs text-ui-muted mb-1">Salvar em pasta (opcional)</label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full mb-5 px-3 py-2 rounded-lg text-sm"
            style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }}
          >
            <option value="">— Raiz (sem pasta) —</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-ui-muted hover:text-ui-text transition-colors"
              style={{ background: '#252535' }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmImport}
              disabled={importing}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--color-secondary)', color: '#1e1e2e', opacity: importing ? 0.7 : 1 }}
            >
              {importing ? 'Importando…' : `Importar ${files.length} nota(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [showSearch,   setShowSearch]   = useState(false)
  const [showSync,     setShowSync]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showImport,   setShowImport]   = useState(false)
  const [showNewNote,  setShowNewNote]  = useState(false)
  const [showLiveMemoryHistory, setShowLiveMemoryHistory] = useState(false)
  const [importFolderId, setImportFolderId] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('personal-brain-sidebar-width')
    return saved ? Math.max(160, parseInt(saved)) : 280
  })
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)
  const { revealInExplorer } = useNotesStore()

  const [notification, setNotification] = useState(null)
  const showNotification = (msg, type = 'success', onAction = null, actionLabel = 'Abrir') => {
    setNotification({ msg, type, onAction, actionLabel })
  }

  const { load, loading, user, loginUser, settings, createNote, encryptionKey, setEncryptionKey, notes, checkNovidades } = useNotesStore()

  // Apply theme CSS variables whenever settings change
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary',   settings.primaryColor   || '#cba6f7')
    document.documentElement.style.setProperty('--color-secondary', settings.secondaryColor || '#89b4fa')
  }, [settings.primaryColor, settings.secondaryColor])

  useEffect(() => { load() }, [load])

  // After load completes and user is set, check/seed Novidades note
  // Deferred so Editor is mounted before we change the active note
  useEffect(() => {
    if (!loading && user) {
      const t = setTimeout(() => checkNovidades(), 300)
      return () => clearTimeout(t)
    }
  }, [loading, user])

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Ctrl+K / Ctrl+N
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setShowNewNote(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Sidebar resize (desktop)
  const onMouseDown = (e) => {
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = sidebarWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setSidebarWidth(Math.max(160, startW.current + delta))
    }
    const onUp = (e) => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
      const finalW = Math.max(160, startW.current + (e.clientX - startX.current))
      localStorage.setItem('personal-brain-sidebar-width', String(finalW))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const openImport = useCallback((folderId = null) => {
    setImportFolderId(folderId)
    setShowImport(true)
  }, [])

  const handleNewNote = useCallback(() => {
    createNote()
    if (isMobile) setMobileSidebarOpen(false)
  }, [createNote, isMobile])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#0d0d1a' }}>
        <ParticleBackground />
        <div className="relative z-10 text-center text-ui-muted">
          <div className="text-4xl mb-3 animate-pulse">⬡</div>
          <div className="text-sm">Carregando {settings.extra?.projectName || 'Personal Brain'}...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <ParticleBackground />
        <NicknameModal onConfirm={loginUser} />
      </>
    )
  }

  // User is logged in but has no encryption key on this device → must provide it
  if (!encryptionKey) {
    const hasEncryptedNotes = notes.some(
      (n) => isEncrypted(n.title) || isEncrypted(n.content)
    )
    return (
      <>
        <ParticleBackground />
        <KeyModal hasEncryptedNotes={hasEncryptedNotes} onConfirm={setEncryptionKey} />
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <ParticleBackground />

      <div className="relative z-10 flex w-full h-full">

        {/* ── Mobile: overlay when sidebar open ── */}
        {isMobile && mobileSidebarOpen && (
          <div
            className="mobile-sidebar-overlay"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        {isMobile ? (
          <div className={`mobile-sidebar-drawer ${mobileSidebarOpen ? 'open' : ''}`}>
            <Sidebar
              onSearch={() => { setShowSearch(true); setMobileSidebarOpen(false) }}
              onSync={() => { setShowSync(true); setMobileSidebarOpen(false) }}
              onSettings={() => { setShowSettings(true); setMobileSidebarOpen(false) }}
              onImport={openImport}
              onLiveMemoryHistory={() => setShowLiveMemoryHistory(true)}
            />
          </div>
        ) : (
          !sidebarCollapsed && (
            <div style={{ width: sidebarWidth, flexShrink: 0 }}>
              <Sidebar
                onSearch={() => setShowSearch(true)}
                onSync={() => setShowSync(true)}
                onSettings={() => setShowSettings(true)}
                onImport={openImport}
                onLiveMemoryHistory={() => setShowLiveMemoryHistory(true)}
              />
            </div>
          )
        )}

        {/* ── Desktop: resize handle ── */}
        {!isMobile && !sidebarCollapsed && (
          <div
            onMouseDown={onMouseDown}
            style={{
              width: 4,
              flexShrink: 0,
              cursor: 'col-resize',
              background: '#313244',
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--color-primary)')}
            onMouseOut={(e)  => (e.currentTarget.style.background = '#313244')}
          />
        )}

        {/* ── Desktop: sidebar collapse toggle ── */}
        {!isMobile && (
          <button
            className="sidebar-toggle"
            style={{ left: sidebarCollapsed ? 0 : sidebarWidth + 4 }}
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Abrir barra lateral' : 'Fechar barra lateral'}
          >
            {sidebarCollapsed
              ? <ChevronRight size={11} />
              : <ChevronLeft  size={11} />
            }
          </button>
        )}

        {/* ── Editor ── */}
        <div className={`flex-1 overflow-hidden ${isMobile ? 'editor-main-area' : ''}`}>
          <Editor 
            onImport={openImport} 
            showNotification={showNotification}
            revealInExplorer={revealInExplorer}
          />
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          <button
            className={mobileSidebarOpen ? 'active' : ''}
            onClick={() => setMobileSidebarOpen((o) => !o)}
          >
            <BookOpen size={20} />
            <span>Notas</span>
          </button>
          <button onClick={() => setShowSearch(true)}>
            <Search size={20} />
            <span>Buscar</span>
          </button>
          <button onClick={handleNewNote}>
            <Plus size={20} />
            <span>Nova</span>
          </button>
          <button onClick={() => setShowImport(null)}>
            <Upload size={20} />
            <span>Import</span>
          </button>
          <button onClick={() => setShowSettings(true)}>
            <Settings size={20} />
            <span>Config</span>
          </button>
        </nav>
      )}

      {/* ── Modals ── */}
      {showNewNote  && <NewNoteModal onClose={() => setShowNewNote(false)} onCreate={async (title, folderId) => { await createNote(title, folderId); if (isMobile) setMobileSidebarOpen(false) }} />}
      {showSearch   && <SearchModal  onClose={() => setShowSearch(false)} />}
      {showSync     && <SyncModal    onClose={() => setShowSync(false)} />}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          showNotification={showNotification}
          revealInExplorer={revealInExplorer}
        />
      )}
      {showImport   && (
        <ImportModal
          defaultFolderId={importFolderId}
          onClose={() => setShowImport(false)}
        />
      )}
      {showLiveMemoryHistory && <LiveMemoryHistory onClose={() => setShowLiveMemoryHistory(false)} />}

      {/* Screenkey overlay */}
      {settings.extra?.screenKey && <ScreenkeyOverlay />}

      {notification && (
        <Notification 
          message={notification.msg} 
          type={notification.type} 
          onAction={notification.onAction}
          actionLabel={notification.actionLabel}
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  )
}

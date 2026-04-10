import React, { useState } from 'react'
import { Globe, X, Link, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { BalloonOverlay } from '../common/BalloonOverlay'

const API = () => `http://${window.location.hostname}:3001/api`

export function ScraperPanel({ folders, onCreate }) {
  const [open, setOpen] = useState(true)
  const [url, setUrl]   = useState('')

  // Modal state
  const [modal, setModal]       = useState(false)
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

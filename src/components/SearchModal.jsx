import React, { useState, useEffect, useRef } from 'react'
import { Search, X, FileText, Link, ExternalLink } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { dbSearchLiveMemories } from '../db/database'

export default function SearchModal({ onClose }) {
  const { notes, setActiveNote, user } = useNotesStore()
  const [query, setQuery] = useState('')
  const [searchNotes, setSearchNotes] = useState(true)
  const [searchLiveMemories, setSearchLiveMemories] = useState(false)
  const [liveResults, setLiveResults] = useState([])
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Debounced live memory search
  useEffect(() => {
    if (!searchLiveMemories || !user || !query.trim()) {
      setLiveResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await dbSearchLiveMemories(user.id, query.trim(), 15)
        setLiveResults(results)
      } catch { setLiveResults([]) }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [query, searchLiveMemories, user])

  const noteResults = query.trim() && searchNotes
    ? notes.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase())
      )
    : (searchNotes ? notes.slice(0, 8) : [])

  const highlight = (text, q) => {
    if (!q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight bg-yellow-400/20 text-yellow-200">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  const getSnippet = (content, q) => {
    if (!q) return content.slice(0, 80) + '...'
    const idx = content.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return content.slice(0, 80) + '...'
    const start = Math.max(0, idx - 30)
    const end = Math.min(content.length, idx + q.length + 50)
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')
  }

  const handleSelect = (id) => { setActiveNote(id); onClose() }

  const totalResults = noteResults.length + liveResults.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl shadow-2xl overflow-hidden fade-in"
        style={{ background: '#252535', border: '1px solid #313244' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #313244' }}>
          <Search size={16} className="text-ui-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="flex-1 bg-transparent text-ui-text text-sm outline-none placeholder-ui-muted"
          />
          <button onClick={onClose} className="text-ui-muted hover:text-ui-text"><X size={16} /></button>
        </div>

        {/* Scope filters */}
        <div className="flex items-center gap-4 px-4 py-2" style={{ borderBottom: '1px solid #313244', background: '#1e1e2e' }}>
          <span className="text-xs text-ui-muted">Buscar em:</span>
          <label className="flex items-center gap-1.5 text-xs text-ui-muted cursor-pointer">
            <input type="checkbox" checked={searchNotes} onChange={e => setSearchNotes(e.target.checked)}
              className="accent-ui-accent w-3 h-3" />
            <FileText size={11} /> Notas
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ui-muted cursor-pointer">
            <input type="checkbox" checked={searchLiveMemories} onChange={e => setSearchLiveMemories(e.target.checked)}
              className="accent-blue-500 w-3 h-3" />
            <Link size={11} /> Live Memories
          </label>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {/* Notes section */}
          {searchNotes && noteResults.length > 0 && (
            <>
              {searchLiveMemories && (
                <div className="px-4 py-1.5 text-xs text-ui-muted font-semibold"
                  style={{ background: '#1e1e2e', borderBottom: '1px solid #313244' }}>
                  Notas ({noteResults.length})
                </div>
              )}
              {noteResults.map(note => (
                <button
                  key={note.id}
                  onClick={() => handleSelect(note.id)}
                  className="w-full text-left px-4 py-3 hover:bg-ui-hover transition-colors"
                  style={{ borderBottom: '1px solid #1e1e2e' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText size={13} className="text-ui-accent flex-shrink-0" />
                    <span className="text-ui-text text-sm font-medium">{highlight(note.title, query)}</span>
                  </div>
                  <div className="text-ui-muted text-xs pl-5 font-mono">
                    {highlight(getSnippet(note.content, query), query)}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Live Memories section */}
          {searchLiveMemories && liveResults.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs text-ui-muted font-semibold"
                style={{ background: '#1e1e2e', borderBottom: '1px solid #313244' }}>
                Live Memories ({liveResults.length})
              </div>
              {liveResults.map(mem => (
                <button
                  key={mem.id}
                  onClick={() => { window.open(mem.url, '_blank', 'noopener'); onClose() }}
                  className="w-full text-left px-4 py-3 hover:bg-ui-hover transition-colors"
                  style={{ borderBottom: '1px solid #1e1e2e' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Link size={13} className="text-blue-400 flex-shrink-0" />
                    <span className="text-ui-text text-sm font-medium">{highlight(mem.title || mem.url, query)}</span>
                    <ExternalLink size={11} className="text-ui-muted ml-auto flex-shrink-0" />
                  </div>
                  <div className="text-ui-muted text-xs pl-5 font-mono truncate">{mem.url}</div>
                </button>
              ))}
            </>
          )}

          {/* Empty state */}
          {totalResults === 0 && (
            <div className="px-4 py-8 text-center text-ui-muted text-sm">
              {query.trim() ? 'Nenhum resultado encontrado' : 'Comece a digitar para buscar'}
            </div>
          )}
        </div>

        <div className="px-4 py-2 text-ui-muted text-xs" style={{ borderTop: '1px solid #313244' }}>
          {totalResults} resultado{totalResults !== 1 ? 's' : ''} · ESC para fechar
        </div>
      </div>
    </div>
  )
}

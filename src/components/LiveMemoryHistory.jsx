import React, { useState, useEffect, useCallback } from 'react'
import { X, Link, Trash2, ExternalLink, FilePlus, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { dbGetLiveMemories, dbDeleteLiveMemoriesBulk } from '../db/database'

const PAGE_SIZE = 25

function formatDate(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return ts }
}

function truncateUrl(url, max = 50) {
  if (!url) return '—'
  try {
    const u = new URL(url)
    const s = u.hostname + u.pathname
    return s.length > max ? s.slice(0, max) + '…' : s
  } catch { return url.length > max ? url.slice(0, max) + '…' : url }
}

export default function LiveMemoryHistory({ onClose }) {
  const { user, createNote, deleteLiveMemory } = useNotesStore()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [tooltip, setTooltip] = useState(null)

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await dbGetLiveMemories(user.id, { page, limit: PAGE_SIZE, q: debouncedQuery || undefined })
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user, page, debouncedQuery])

  useEffect(() => { load() }, [load])

  // Reset page on query change
  useEffect(() => { setPage(1) }, [debouncedQuery])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.id)))
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Deletar ${selected.size} item(s)?`)) return
    await dbDeleteLiveMemoriesBulk(user.id, [...selected])
    setSelected(new Set())
    load()
  }

  const handleDeleteOne = async (id) => {
    await deleteLiveMemory(id)
    setItems(prev => prev.filter(i => i.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  const handleCreateNote = async (mem) => {
    const title = `Link: ${mem.title || mem.url}`
    const content = `# ${title}\n\n> Salvo em ${formatDate(mem.timestamp)}\n\n[Abrir link](${mem.url})\n`
    await createNote(title, null, content)
    onClose()
  }

  const handleExport = () => {
    const data = JSON.stringify(items, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `live-memories-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: '#161622' }}>
        <div className="flex items-center gap-2">
          <Link size={16} className="text-blue-400" />
          <span className="text-ui-text text-sm font-semibold">Live Memory History</span>
          <span className="text-ui-muted text-xs">{total} links capturados</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: '#1e1e2e' }}>
        <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-1.5 rounded-lg"
          style={{ background: '#252535', border: '1px solid #45475a' }}>
          <Search size={13} className="text-ui-muted" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filtrar por título ou URL..."
            className="flex-1 bg-transparent text-sm text-ui-text outline-none placeholder-ui-muted"
          />
        </div>

        {selected.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
            style={{ border: '1px solid #45475a' }}
          >
            <Trash2 size={12} /> Deletar {selected.size} selecionado{selected.size > 1 ? 's' : ''}
          </button>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-ui-muted hover:text-ui-text hover:bg-ui-hover transition-colors"
          style={{ border: '1px solid #45475a' }}
        >
          <Download size={12} /> Exportar
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e1e2e', borderBottom: '1px solid #313244' }}>
              <th className="px-4 py-2 text-left w-8">
                <input type="checkbox" checked={selected.size === items.length && items.length > 0}
                  onChange={toggleAll} className="accent-blue-500" />
              </th>
              <th className="px-4 py-2 text-left text-ui-muted font-medium">Título</th>
              <th className="px-4 py-2 text-left text-ui-muted font-medium">URL</th>
              <th className="px-4 py-2 text-left text-ui-muted font-medium">Data</th>
              <th className="px-4 py-2 text-left text-ui-muted font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ui-muted">Carregando...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-ui-muted">
                  {query ? 'Nenhum resultado para a busca' : 'Nenhum link capturado ainda'}
                </td>
              </tr>
            ) : items.map(mem => (
              <tr key={mem.id}
                className="hover:bg-ui-hover/50 transition-colors"
                style={{ borderBottom: '1px solid #1e1e2e' }}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(mem.id)}
                    onChange={() => toggleSelect(mem.id)} className="accent-blue-500" />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {mem.favicon ? (
                      <img src={mem.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0"
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <Link size={13} className="text-blue-400 flex-shrink-0" />
                    )}
                    <span className="text-ui-text font-medium max-w-[200px] truncate" title={mem.title}>
                      {mem.title || '(sem título)'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="text-ui-muted font-mono max-w-[240px] truncate block cursor-help"
                    title={mem.url}
                    onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, text: mem.url })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {truncateUrl(mem.url)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ui-muted whitespace-nowrap">
                  {formatDate(mem.timestamp)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => window.open(mem.url, '_blank', 'noopener')}
                      className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-blue-400 transition-colors"
                      title="Abrir link"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      onClick={() => handleCreateNote(mem)}
                      className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-accent transition-colors"
                      title="Criar nota a partir"
                    >
                      <FilePlus size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteOne(mem.id)}
                      className="p-1 rounded hover:bg-red-900/20 text-ui-muted hover:text-red-400 transition-colors"
                      title="Deletar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid #313244', background: '#161622' }}>
        <span className="text-xs text-ui-muted">
          {total} itens · Página {page} de {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded hover:bg-ui-hover text-ui-muted disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded hover:bg-ui-hover text-ui-muted disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* URL tooltip */}
      {tooltip && (
        <div className="fixed z-[999] pointer-events-none px-3 py-1.5 rounded text-xs font-mono text-ui-muted"
          style={{ left: tooltip.x + 10, top: tooltip.y - 30, background: '#1e1e2e', border: '1px solid #313244', maxWidth: 400 }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

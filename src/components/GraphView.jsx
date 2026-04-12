import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Link, FileText, Trash2, ExternalLink, FilePlus } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import * as d3 from 'd3'

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({ menu, onClose, onAction }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!menu) return null

  const { x, y, node } = menu
  const isLiveMemory = node.type === 'live_memory'

  return (
    <div
      ref={ref}
      className="fixed z-[200] rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: Math.min(x, window.innerWidth - 220),
        top: Math.min(y, window.innerHeight - 220),
        background: '#1e1e2e',
        border: '1px solid #313244',
        minWidth: 200,
      }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-ui-accent flex items-center gap-2"
        style={{ borderBottom: '1px solid #313244' }}>
        {isLiveMemory ? <Link size={12} /> : <FileText size={12} />}
        <span className="truncate max-w-[160px]">{node.title}</span>
      </div>
      <div className="py-1">
        {!isLiveMemory && (
          <button
            className="w-full text-left px-3 py-2 text-xs text-ui-text hover:bg-ui-hover flex items-center gap-2 transition-colors"
            onClick={() => onAction('edit', node)}
          >
            <FileText size={12} className="text-ui-muted" /> Editar nota
          </button>
        )}
        <button
          className="w-full text-left px-3 py-2 text-xs text-ui-text hover:bg-ui-hover flex items-center gap-2 transition-colors"
          onClick={() => onAction('create-from', node)}
        >
          <FilePlus size={12} className="text-ui-muted" />
          {isLiveMemory ? 'Criar nota a partir deste link' : 'Criar cópia da nota'}
        </button>
        {isLiveMemory && (
          <button
            className="w-full text-left px-3 py-2 text-xs text-ui-text hover:bg-ui-hover flex items-center gap-2 transition-colors"
            onClick={() => onAction('open-url', node)}
          >
            <ExternalLink size={12} className="text-ui-muted" /> Abrir link
          </button>
        )}
        {isLiveMemory && (
          <button
            className="w-full text-left px-3 py-2 text-xs text-ui-text hover:bg-ui-hover flex items-center gap-2 transition-colors"
            onClick={() => onAction('copy-url', node)}
          >
            <Link size={12} className="text-ui-muted" /> Copiar URL
          </button>
        )}
        <div style={{ borderTop: '1px solid #313244', margin: '4px 0' }} />
        <button
          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 flex items-center gap-2 transition-colors"
          onClick={() => onAction('delete', node)}
        >
          <Trash2 size={12} /> Deletar
        </button>
        <button
          className="w-full text-left px-3 py-2 text-xs text-ui-muted hover:bg-ui-hover flex items-center gap-2 transition-colors"
          onClick={onClose}
        >
          <X size={12} /> Fechar
        </button>
      </div>
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ tooltip }) {
  if (!tooltip) return null
  return (
    <div
      className="fixed z-[199] pointer-events-none rounded-lg px-3 py-2 text-xs"
      style={{
        left: tooltip.x + 12,
        top: tooltip.y - 10,
        background: 'rgba(22,22,34,0.97)',
        border: '1px solid #313244',
        maxWidth: 280,
      }}
    >
      <div className="text-ui-text font-semibold truncate">{tooltip.title}</div>
      {tooltip.url && <div className="text-ui-muted mt-0.5 truncate">{tooltip.url}</div>}
    </div>
  )
}

// ─── GraphView ────────────────────────────────────────────────────────────────
export default function GraphView({ onClose }) {
  const svgRef = useRef(null)
  const liveMemories = useNotesStore(state => state.liveMemories)
  const { notes, setActiveNote, getLinks, createNote, deleteNote, fetchLiveMemories, deleteLiveMemory, settings, user } = useNotesStore()
  console.log('[Graph] componente re-renderizou, liveMemories:', liveMemories.length)

  const [showNotes, setShowNotes] = useState(true)
  const [showLiveMemories, setShowLiveMemories] = useState(
    settings?.extra?.showLiveMemoriesInGraph !== false
  )
  const [contextMenu, setContextMenu] = useState(null)
  const [tooltip, setTooltip] = useState(null)

  // Fetch live memories on mount
  useEffect(() => {
    if (user) fetchLiveMemories({ limit: 500 })
  }, [user])

  const handleAction = useCallback(async (action, node) => {
    setContextMenu(null)
    if (action === 'edit') {
      setActiveNote(node.id)
      onClose()
    } else if (action === 'open-url') {
      window.open(node.url, '_blank', 'noopener')
    } else if (action === 'copy-url') {
      navigator.clipboard.writeText(node.url).catch(() => {})
    } else if (action === 'delete') {
      if (node.type === 'live_memory') {
        await deleteLiveMemory(node.id)
      } else {
        await deleteNote(node.id)
      }
    } else if (action === 'create-from') {
      if (node.type === 'live_memory') {
        const title = `Link: ${node.title || node.url}`
        const content = `# ${title}\n\n> Criado a partir de [[Live Memory]]\n\n[Abrir link](${node.url})\n`
        await createNote(title, null, content)
        onClose()
      } else {
        await createNote(`Cópia de ${node.title}`, null, '')
        onClose()
      }
    }
  }, [setActiveNote, onClose, deleteLiveMemory, deleteNote, createNote])

  useEffect(() => {
    console.log('[Graph] useEffect rodou, liveMemories:', liveMemories.length)
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Build nodes
    const allNodes = []
    if (showNotes) {
      notes.forEach(n => allNodes.push({ id: n.id, title: n.title, type: 'note' }))
    }
    if (showLiveMemories) {
      liveMemories.forEach(m => allNodes.push({ id: m.id, title: m.title || m.url, url: m.url, type: 'live_memory' }))
    }

    // Build links (note → note via wiki-links + live_memory → live_memory mesh)
    const nodeMap = new Map(notes.map(n => [n.title.toLowerCase(), n]))
    const links = []
    if (showNotes) {
      notes.forEach(note => {
        const linked = getLinks(note.content)
        linked.forEach(title => {
          const target = nodeMap.get(title.toLowerCase())
          if (target && allNodes.find(n => n.id === target.id)) {
            links.push({ source: note.id, target: target.id })
          }
        })
      })
    }
    // Link all live_memory nodes to each other (internet knowledge mesh)
    if (showLiveMemories && liveMemories.length > 1) {
      const lmNodes = allNodes.filter(n => n.type === 'live_memory')
      for (let i = 0; i < lmNodes.length; i++) {
        for (let j = i + 1; j < lmNodes.length; j++) {
          links.push({ source: lmNodes[i].id, target: lmNodes[j].id, isInternet: true })
        }
      }
    }

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height)
    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', e => g.attr('transform', e.transform)))

    const simulation = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(-50))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(12))

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => d.isInternet ? '#1d4ed8' : '#313244')
      .attr('stroke-width', d => d.isInternet ? 0.8 : 1.5)
      .attr('stroke-opacity', d => d.isInternet ? 0.3 : 0.8)
      .attr('stroke-dasharray', d => d.isInternet ? '3,3' : null)

    const connectionCount = new Map(allNodes.map(n => [n.id, 0]))
    links.forEach(l => {
      const sid = l.source.id || l.source
      const tid = l.target.id || l.target
      connectionCount.set(sid, (connectionCount.get(sid) || 0) + 1)
      connectionCount.set(tid, (connectionCount.get(tid) || 0) + 1)
    })

    const node = g.append('g').selectAll('g').data(allNodes).join('g')
      .attr('class', 'graph-node')
      .call(
        d3.drag()
          .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on('click', (event, d) => {
        if (d.type === 'note') { setActiveNote(d.id); onClose() }
      })
      .on('dblclick', (event, d) => {
        if (d.type === 'live_memory') window.open(d.url, '_blank', 'noopener')
      })
      .on('contextmenu', (event, d) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mouseover', function (event, d) {
        d3.select(this).select('circle').attr('stroke-width', 3)
        setTooltip({ x: event.clientX, y: event.clientY, title: d.title, url: d.url })
      })
      .on('mousemove', (event) => {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseout', function () {
        d3.select(this).select('circle').attr('stroke-width', 2)
        setTooltip(null)
      })

    // Circles
    node.append('circle')
      .attr('r', d => {
        if (d.type === 'live_memory') return 8
        return 8 + Math.min((connectionCount.get(d.id) || 0) * 2, 12)
      })
      .attr('fill', d => {
        if (d.type === 'live_memory') return '#3b82f6'
        const count = connectionCount.get(d.id) || 0
        if (count >= 3) return '#cba6f7'
        if (count >= 1) return '#89b4fa'
        return '#45475a'
      })
      .attr('stroke', '#1e1e2e')
      .attr('stroke-width', 2)
      .attr('opacity', d => d.type === 'live_memory' ? 0.8 : 1)

    // Labels
    node.append('text')
      .text(d => d.title?.length > 22 ? d.title.slice(0, 22) + '…' : d.title)
      .attr('dy', d => (d.type === 'live_memory' ? 8 : 8 + Math.min((connectionCount.get(d.id) || 0) * 2, 12)) + 6)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.type === 'live_memory' ? '#93c5fd' : '#a6adc8')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [notes, liveMemories, showNotes, showLiveMemories])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: '#161622' }}>
        <div className="flex items-center gap-2">
          <span className="text-ui-accent">⬡</span>
          <span className="text-ui-text text-sm font-semibold">Grafo de Conhecimento</span>
          <span className="text-ui-muted text-xs">
            {showNotes ? notes.length : 0} notas
            {showLiveMemories ? ` · ${liveMemories.length} links` : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Toggles */}
          <label className="flex items-center gap-1.5 text-xs text-ui-muted cursor-pointer select-none">
            <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)}
              className="accent-ui-accent w-3 h-3" />
            <FileText size={11} /> Notas
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ui-muted cursor-pointer select-none">
            <input type="checkbox" checked={showLiveMemories} onChange={e => setShowLiveMemories(e.target.checked)}
              className="accent-blue-500 w-3 h-3" />
            <Link size={11} /> Live Memories
          </label>
          <span className="text-ui-muted text-xs hidden md:block">Arraste · Scroll zoom · Clique = nota · Duplo clique = link</span>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" style={{ background: '#0d0d1a' }} />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 p-3 rounded-lg text-xs text-ui-muted"
          style={{ background: 'rgba(22,22,34,0.9)', border: '1px solid #313244' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-ui-accent" />
            <span>Hub (3+ links)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-ui-blue" />
            <span>Conectado (1-2 links)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: '#45475a' }} />
            <span>Isolado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 opacity-80" />
            <span>Live Memory</span>
          </div>
        </div>

        {/* Right-click hint */}
        <div className="absolute bottom-4 right-4 text-xs text-ui-muted/60"
          style={{ background: 'rgba(22,22,34,0.7)', borderRadius: 6, padding: '4px 8px', border: '1px solid #313244' }}>
          Clique direito para opções
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onAction={handleAction} />

      {/* Tooltip */}
      <Tooltip tooltip={tooltip} />
    </div>
  )
}

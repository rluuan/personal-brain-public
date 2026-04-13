import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Link, FileText, Trash2, ExternalLink, FilePlus, Brain, RefreshCw } from 'lucide-react'
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
  const isClaude = node.type === 'claude_memory'

  return (
    <div
      ref={ref}
      className="fixed z-[200] rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: Math.min(x, window.innerWidth - 220),
        top: Math.min(y, window.innerHeight - 220),
        background: '#02040f',
        border: '1px solid #00d4ff33',
        minWidth: 200,
        boxShadow: '0 0 30px #00d4ff18, 0 8px 32px #000',
      }}
    >
      <div className="px-3 py-2 text-xs font-semibold flex items-center gap-2"
        style={{ borderBottom: '1px solid #00d4ff22', color: isClaude ? '#a78bfa' : '#00e5ff', fontFamily: 'JetBrains Mono, monospace' }}>
        {isLiveMemory ? <Link size={12} /> : isClaude ? <Brain size={12} /> : <FileText size={12} />}
        <span className="truncate max-w-[160px]">{node.title}</span>
      </div>
      <div className="py-1">
        {!isLiveMemory && !isClaude && (
          <button
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
            style={{ color: '#b2ebf2', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseOver={e => e.currentTarget.style.background = '#00d4ff11'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onAction('edit', node)}
          >
            <FileText size={12} style={{ color: '#00b8d9' }} /> Editar nota
          </button>
        )}
        {!isClaude && (
          <button
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
            style={{ color: '#b2ebf2', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseOver={e => e.currentTarget.style.background = '#00d4ff11'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onAction('create-from', node)}
          >
            <FilePlus size={12} style={{ color: '#00b8d9' }} />
            {isLiveMemory ? 'Criar nota a partir deste link' : 'Criar cópia da nota'}
          </button>
        )}
        {isLiveMemory && (
          <button
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
            style={{ color: '#b2ebf2', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseOver={e => e.currentTarget.style.background = '#00d4ff11'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onAction('open-url', node)}
          >
            <ExternalLink size={12} style={{ color: '#00b8d9' }} /> Abrir link
          </button>
        )}
        {isLiveMemory && (
          <button
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
            style={{ color: '#b2ebf2', fontFamily: 'JetBrains Mono, monospace' }}
            onMouseOver={e => e.currentTarget.style.background = '#00d4ff11'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onAction('copy-url', node)}
          >
            <Link size={12} style={{ color: '#00b8d9' }} /> Copiar URL
          </button>
        )}
        <div style={{ borderTop: '1px solid #00d4ff22', margin: '4px 0' }} />
        {!isClaude && (
          <button
            className="w-full text-left px-3 py-2 text-xs text-red-400 flex items-center gap-2 transition-colors"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onAction('delete', node)}
          >
            <Trash2 size={12} /> Deletar
          </button>
        )}
        <button
          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
          style={{ color: '#4dd0e1', fontFamily: 'JetBrains Mono, monospace' }}
          onMouseOver={e => e.currentTarget.style.background = '#00d4ff11'}
          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
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
        left: tooltip.x + 14,
        top: tooltip.y - 12,
        background: 'rgba(0,4,18,0.96)',
        border: '1px solid #00d4ff44',
        maxWidth: 280,
        boxShadow: '0 0 20px #00d4ff22, 0 4px 16px #000',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div style={{ color: '#e0f7fa' }} className="font-semibold truncate">{tooltip.title}</div>
      {tooltip.url && <div style={{ color: '#4dd0e1' }} className="mt-0.5 truncate opacity-70">{tooltip.url}</div>}
      {tooltip.project && <div style={{ color: '#a78bfa' }} className="mt-0.5 text-[10px] opacity-70">📁 {tooltip.project}</div>}
    </div>
  )
}

// ─── Node helpers ─────────────────────────────────────────────────────────────
function nodeRadius(d, connCount) {
  if (d.type === 'live_memory') return 4
  if (d.type === 'claude_memory') return 3.5
  const c = connCount.get(d.id) || 0
  if (c >= 3) return 8
  if (c >= 1) return 6
  return 4.5
}

function nodeCoreColor(d, connCount) {
  if (d.type === 'live_memory') return '#1a6fff'
  if (d.type === 'claude_memory') {
    // color per project via hash
    const hash = [...(d.project || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 80%, 65%)`
  }
  const c = connCount.get(d.id) || 0
  if (c >= 3) return '#00ffff'
  if (c >= 1) return '#00c8f0'
  return '#00526a'
}

function nodeGlowColor(d, connCount) {
  if (d.type === 'live_memory') return '#0055ff'
  if (d.type === 'claude_memory') {
    const hash = [...(d.project || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 70%, 50%)`
  }
  const c = connCount.get(d.id) || 0
  if (c >= 3) return '#00ffff'
  return '#00b8d9'
}

// ─── Birth animation for a single new node group ──────────────────────────────
function animateNodeBirth(nodeGroup, d, connCount, cx, cy) {
  // Start from center
  d.x = cx + (Math.random() - 0.5) * 20
  d.y = cy + (Math.random() - 0.5) * 20

  nodeGroup.append('circle').attr('class', 'glow-outer')
    .attr('r', nodeRadius(d, connCount) * 5.5)
    .attr('fill', nodeGlowColor(d, connCount))
    .attr('opacity', 0.07)
    .style('pointer-events', 'none')

  nodeGroup.append('circle').attr('class', 'glow-mid')
    .attr('r', nodeRadius(d, connCount) * 2.5)
    .attr('fill', nodeGlowColor(d, connCount))
    .attr('opacity', 0.16)
    .style('pointer-events', 'none')

  nodeGroup.append('circle').attr('class', 'core')
    .attr('r', 0)
    .attr('fill', nodeCoreColor(d, connCount))
    .attr('filter', (connCount.get(d.id) || 0) >= 3 ? 'url(#bloom-hub)' : 'url(#bloom-node)')
    .transition()
      .duration(700)
      .ease(d3.easeElasticOut.amplitude(1.1).period(0.45))
      .attr('r', nodeRadius(d, connCount))

  nodeGroup.append('text')
    .text(d.title?.length > 20 ? d.title.slice(0, 20) + '…' : d.title)
    .attr('dy', nodeRadius(d, connCount) + 11)
    .attr('text-anchor', 'middle')
    .attr('fill', nodeCoreColor(d, connCount))
    .attr('font-size', '9px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('opacity', 0)
    .style('pointer-events', 'none')
    .style('user-select', 'none')
    .transition().delay(800).duration(500)
    .attr('opacity', d.type === 'live_memory' ? 0 : 0.85)
}

// ─── GraphView ────────────────────────────────────────────────────────────────
export default function GraphView({ onClose }) {
  const svgRef        = useRef(null)
  const pulseRef      = useRef(null)
  const simRef        = useRef(null)
  const gRef          = useRef(null)
  const nodeLRef      = useRef(null)
  const linkLRef      = useRef(null)
  const connCountRef  = useRef(new Map())
  const allNodesRef   = useRef([])
  const allLinksRef   = useRef([])
  const initDoneRef   = useRef(false)

  // Subscriptions seletivas — re-render APENAS quando dados do grafo mudarem,
  // não quando openTabs/activeNoteId/etc mudar
  const notes         = useNotesStore(state => state.notes)
  const liveMemories  = useNotesStore(state => state.liveMemories)
  const claudeNodes    = useNotesStore(state => state.claudeNodes)
  const claudeLinks    = useNotesStore(state => state.claudeLinks)
  const claudeProjects = useNotesStore(state => state.claudeProjects)
  const settings       = useNotesStore(state => state.settings)
  const user           = useNotesStore(state => state.user)
  const getLinks       = useNotesStore(state => state.getLinks)
  const setActiveNote  = useNotesStore(state => state.setActiveNote)
  const createNote     = useNotesStore(state => state.createNote)
  const deleteNote     = useNotesStore(state => state.deleteNote)
  const fetchLiveMemories   = useNotesStore(state => state.fetchLiveMemories)
  const deleteLiveMemory    = useNotesStore(state => state.deleteLiveMemory)
  const fetchClaudeProjects = useNotesStore(state => state.fetchClaudeProjects)
  const syncClaudeProject   = useNotesStore(state => state.syncClaudeProject)

  const trackClaude = settings?.extra?.trackClaudeMemory === true

  const FILTER_KEY = 'graph-full-filters'
  const savedFilters = (() => { try { return JSON.parse(localStorage.getItem(FILTER_KEY)) } catch { return null } })()
  const [showNotes, setShowNotes]               = useState(savedFilters?.notes         ?? true)
  const [showLiveMemories, setShowLiveMemories] = useState(savedFilters?.live_memory   ?? false)
  const [showClaude, setShowClaude]             = useState(savedFilters?.claude        ?? false)
  const [contextMenu, setContextMenu]           = useState(null)

  // Persist filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ notes: showNotes, live_memory: showLiveMemories, claude: showClaude }))
  }, [showNotes, showLiveMemories, showClaude])
  const [tooltip, setTooltip]                   = useState(null)
  const [syncingAll, setSyncingAll]             = useState(false)

  useEffect(() => {
    if (user) fetchLiveMemories({ limit: 500 })
  }, [user])

  // Auto-load + auto-sync claude projects when graph opens; poll every 60s for new sessions
  useEffect(() => {
    if (!user || !trackClaude) return
    const syncAll = async () => {
      await fetchClaudeProjects()
      const projects = useNotesStore.getState().claudeProjects || []
      for (const p of projects) await syncClaudeProject(p.name)
    }
    syncAll()
    const interval = setInterval(syncAll, 60_000)
    return () => clearInterval(interval)
  }, [user, trackClaude])

  // Auto-sync all projects that have sessions but no nodes yet
  const handleSyncAll = async () => {
    setSyncingAll(true)
    const projects = useNotesStore.getState().claudeProjects || []
    for (const p of projects) {
      await syncClaudeProject(p.name)
    }
    setSyncingAll(false)
  }

  // ── Build nodes/links from current state ─────────────────────────────────
  const buildGraph = useCallback(() => {
    const nodes = []
    if (showNotes) notes.forEach(n => nodes.push({ id: n.id, title: n.title, type: 'note' }))
    if (showLiveMemories) liveMemories.forEach(m => nodes.push({ id: m.id, title: m.title || m.url, url: m.url, type: 'live_memory' }))
    if (showClaude && claudeNodes?.length) claudeNodes.forEach(n => nodes.push({ id: n.id, title: n.summary, project: n.project, type: 'claude_memory' }))

    const nodeMap = new Map(notes.map(n => [n.title.toLowerCase(), n]))
    const links = []
    if (showNotes) {
      notes.forEach(note => {
        getLinks(note.content).forEach(title => {
          const target = nodeMap.get(title.toLowerCase())
          if (target && nodes.find(n => n.id === target.id))
            links.push({ source: note.id, target: target.id })
        })
      })
    }
    if (showLiveMemories && liveMemories.length > 1) {
      const lmNodes = nodes.filter(n => n.type === 'live_memory')
      for (let i = 0; i < lmNodes.length; i++)
        for (let j = i + 1; j < lmNodes.length; j++)
          links.push({ source: lmNodes[i].id, target: lmNodes[j].id, isInternet: true })
    }
    // Claude links from sync (session→subagent, session→memory)
    if (showClaude && claudeLinks?.length) {
      const nodeIds = new Set(nodes.map(n => n.id))
      claudeLinks.forEach(l => {
        if (nodeIds.has(l.source) && nodeIds.has(l.target))
          links.push({ source: l.source, target: l.target, isClaude: true, claudeType: l.type })
      })
    }

    const connCount = new Map(nodes.map(n => [n.id, 0]))
    links.forEach(l => {
      const sid = l.source?.id || l.source
      const tid = l.target?.id || l.target
      connCount.set(sid, (connCount.get(sid) || 0) + 1)
      connCount.set(tid, (connCount.get(tid) || 0) + 1)
    })
    return { nodes, links, connCount }
  }, [notes, liveMemories, claudeNodes, claudeLinks, showNotes, showLiveMemories, showClaude, getLinks])

  // ── Initial SVG setup (runs once) ─────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || initDoneRef.current) return
    initDoneRef.current = true

    const width  = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    const cx = width / 2, cy = height / 2

    d3.select(svgRef.current).selectAll('*').remove()
    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height)
    const g   = svg.append('g')
    gRef.current = g

    svg.call(d3.zoom().scaleExtent([0.05, 8]).on('zoom', e => g.attr('transform', e.transform)))

    // Defs
    const defs = svg.append('defs')
    const bloomHub = defs.append('filter').attr('id', 'bloom-hub')
      .attr('x', '-200%').attr('y', '-200%').attr('width', '500%').attr('height', '500%')
    bloomHub.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 8).attr('result', 'blur')
    const ct = bloomHub.append('feComponentTransfer').attr('in', 'blur').attr('result', 'bright')
    ct.append('feFuncR').attr('type', 'linear').attr('slope', 5)
    ct.append('feFuncG').attr('type', 'linear').attr('slope', 5)
    ct.append('feFuncB').attr('type', 'linear').attr('slope', 5)
    const m1 = bloomHub.append('feMerge')
    m1.append('feMergeNode').attr('in', 'bright')
    m1.append('feMergeNode').attr('in', 'SourceGraphic')

    const bloomNode = defs.append('filter').attr('id', 'bloom-node')
      .attr('x', '-120%').attr('y', '-120%').attr('width', '340%').attr('height', '340%')
    bloomNode.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 4).attr('result', 'blur')
    const m2 = bloomNode.append('feMerge')
    m2.append('feMergeNode').attr('in', 'blur')
    m2.append('feMergeNode').attr('in', 'SourceGraphic')

    const filamentGlow = defs.append('filter').attr('id', 'filament-glow')
      .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
    filamentGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 1.5).attr('result', 'blur')
    const m3 = filamentGlow.append('feMerge')
    m3.append('feMergeNode').attr('in', 'blur')
    m3.append('feMergeNode').attr('in', 'SourceGraphic')

    // Birth flash
    const flash = g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4)
      .attr('fill', '#00ffff').attr('opacity', 1).attr('filter', 'url(#bloom-hub)').style('pointer-events', 'none')
    flash.transition().duration(900).ease(d3.easeCubicOut).attr('r', 140).attr('opacity', 0)
      .on('end', function() { d3.select(this).remove() })

    // Particle burst
    const { nodes: initNodes } = buildGraph()
    const burstCount = Math.min(Math.max(initNodes.length * 4, 40), 100)
    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 140
      const color = Math.random() > 0.45 ? '#00e5ff' : (Math.random() > 0.5 ? '#0080ff' : '#00ffcc')
      g.append('circle')
        .attr('cx', cx + (Math.random() - 0.5) * 8).attr('cy', cy + (Math.random() - 0.5) * 8)
        .attr('r', 0.8 + Math.random() * 2.2).attr('fill', color).attr('opacity', 0.85)
        .style('pointer-events', 'none')
        .transition().duration(500 + Math.random() * 900).ease(d3.easeQuadOut)
        .attr('cx', cx + Math.cos(angle) * speed).attr('cy', cy + Math.sin(angle) * speed)
        .attr('opacity', 0).on('end', function() { d3.select(this).remove() })
    }

    // Panel layer (below links and nodes) — halos por projeto Claude
    g.append('g').attr('class', 'panel-layer')
    // Link layer
    linkLRef.current = g.append('g').attr('class', 'link-layer')
    // Node layer
    nodeLRef.current = g.append('g').attr('class', 'node-layer')

    // Simulation
    simRef.current = d3.forceSimulation([])
      .force('link', d3.forceLink([]).id(d => d.id).distance(d => {
        if (d.isInternet) return 20
        if (d.isClaude) return 40
        return 60
      }).strength(d => d.isInternet ? 0.3 : d.isClaude ? 0.5 : 0.7))
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'live_memory') return -45
        if (d.type === 'claude_memory') return -60
        const c = connCountRef.current.get(d.id) || 0
        if (c >= 3) return -170
        return -100
      }))
      .force('center', d3.forceCenter(cx, cy).strength(0.04))
      .force('collision', d3.forceCollide(d => nodeRadius(d, connCountRef.current) + 5))
      // 3D-like radial spread: push nodes away from center over time
      .force('radial', d3.forceRadial(d => {
        if (d.type === 'claude_memory') return 180 + Math.random() * 80
        return 0
      }, cx, cy).strength(0.02))
      .alpha(0)
      .on('tick', () => {
        if (!linkLRef.current || !nodeLRef.current) return
        linkLRef.current.selectAll('line')
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        nodeLRef.current.selectAll('.cyber-node')
          .attr('transform', d => `translate(${d.x},${d.y})`)
      })

    // Neural pulse timer
    let t = 0
    pulseRef.current = d3.timer(() => {
      t += 0.016
      if (!nodeLRef.current) return
      nodeLRef.current.selectAll('.cyber-node').each(function(d) {
        const seed  = d.id ? (String(d.id).charCodeAt(0) + (String(d.id).charCodeAt(1) || 0)) * 0.05 : 0
        const phase = t + seed
        const r     = nodeRadius(d, connCountRef.current)
        d3.select(this).select('.glow-outer')
          .attr('opacity', 0.04 + Math.abs(Math.sin(phase * 0.65)) * 0.07)
          .attr('r', r * 5.5 + Math.sin(phase * 0.8) * r * 1.2)
        d3.select(this).select('.glow-mid')
          .attr('opacity', 0.1 + Math.abs(Math.sin(phase * 0.9 + 1.2)) * 0.09)
        d3.select(this).select('.core')
          .attr('r', r + Math.sin(phase * 1.3 + seed) * 0.55)
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data update: D3 join — only add/remove delta nodes ────────────────────
  useEffect(() => {
    if (!initDoneRef.current || !simRef.current || !nodeLRef.current || !linkLRef.current) return

    const { nodes, links, connCount } = buildGraph()
    connCountRef.current = connCount

    const width  = svgRef.current?.clientWidth || 800
    const height = svgRef.current?.clientHeight || 600
    const cx = width / 2, cy = height / 2

    // Preserve existing node positions
    const prevById = new Map(allNodesRef.current.map(n => [n.id, n]))
    nodes.forEach(n => {
      const prev = prevById.get(n.id)
      if (prev) { n.x = prev.x; n.y = prev.y; n.vx = prev.vx; n.vy = prev.vy }
    })

    const prevIds  = new Set(allNodesRef.current.map(n => n.id))
    const nextIds  = new Set(nodes.map(n => n.id))
    const addedIds = new Set([...nextIds].filter(id => !prevIds.has(id)))

    allNodesRef.current = nodes
    allLinksRef.current = links

    // ── Update links via join ─────────────────────────────────────────────
    linkLRef.current.selectAll('line').data(links, d => `${d.source?.id || d.source}-${d.target?.id || d.target}`)
      .join(
        enter => enter.append('line')
          .attr('stroke', d => {
            if (d.isInternet) return '#0044cc'
            if (d.isClaude) {
              const hash = [...(d.claudeProject || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
              return `hsl(${Math.abs(hash) % 360}, 70%, 55%)`
            }
            return '#00c8f0'
          })
          .attr('stroke-width', d => d.isInternet ? 0.4 : d.isClaude ? 1.2 : 1.5)
          .attr('stroke-opacity', 0)
          .attr('filter', d => (!d.isInternet && !d.isClaude) ? 'url(#filament-glow)' : null)
          .call(sel => sel.transition().delay((_, i) => i * 4).duration(700)
            .attr('stroke-opacity', d => d.isInternet ? 0.15 : d.isClaude ? 0.6 : 0.75)),
        update => update,
        exit => exit.transition().duration(300).attr('stroke-opacity', 0).remove()
      )

    // ── Update nodes via join ─────────────────────────────────────────────
    const nodeGroups = nodeLRef.current.selectAll('.cyber-node')
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append('g').attr('class', 'cyber-node')
          g.each(function(d) { animateNodeBirth(d3.select(this), d, connCount, cx, cy) })
          return g
        },
        update => update,
        exit => exit.transition().duration(300)
          .style('opacity', 0).remove()
      )

    // Re-attach interactions (needed after join)
    nodeGroups
      .on('contextmenu', (event, d) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mouseover', function(event, d) {
        d3.select(this).select('.glow-outer').transition().duration(150).attr('opacity', 0.22)
        d3.select(this).select('.core').transition().duration(150).attr('r', nodeRadius(d, connCount) * 1.7)
        setTooltip({ x: event.clientX, y: event.clientY, title: d.title, url: d.url, project: d.project })
      })
      .on('mousemove', (event) => {
        setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseout', function(_, d) {
        d3.select(this).select('.glow-outer').transition().duration(220).attr('opacity', 0.07)
        d3.select(this).select('.core').transition().duration(220).attr('r', nodeRadius(d, connCount))
        setTooltip(null)
      })
      .on('dblclick', (event, d) => {
        if (d.type === 'live_memory') window.open(d.url, '_blank', 'noopener')
      })
      .on('click', (event, d) => {
        if (d.type === 'note') { setActiveNote(d.id); onClose() }

        const adjacency = new Map(nodes.map(n => [n.id, []]))
        links.forEach(l => {
          const sid = typeof l.source === 'object' ? l.source.id : l.source
          const tid = typeof l.target === 'object' ? l.target.id : l.target
          if (adjacency.has(sid)) adjacency.get(sid).push(tid)
          if (adjacency.has(tid)) adjacency.get(tid).push(sid)
        })
        const visited = new Set([d.id])
        let frontier = [d.id], depth = 0
        const wave = () => {
          if (!frontier.length || depth > 5) return
          const next = []
          frontier.forEach(nid => {
            nodeLRef.current?.selectAll('.cyber-node').filter(n => n.id === nid).each(function(nd) {
              const r = nodeRadius(nd, connCount)
              d3.select(this).select('.core')
                .transition().duration(180).attr('r', r * 3).attr('fill', '#ffffff')
                .transition().duration(550).ease(d3.easeQuadOut).attr('r', r).attr('fill', nodeCoreColor(nd, connCount))
              d3.select(this).select('.glow-outer')
                .transition().duration(180).attr('opacity', 0.5)
                .transition().duration(550).attr('opacity', 0.07)
            })
            ;(adjacency.get(nid) || []).forEach(nb => { if (!visited.has(nb)) { visited.add(nb); next.push(nb) } })
          })
          frontier = next; depth++
          setTimeout(wave, 160)
        }
        wave()
      })
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) simRef.current.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end',   (event, d) => { if (!event.active) simRef.current.alphaTarget(0); d.fx = null; d.fy = null })
      )

    // ── Update simulation ─────────────────────────────────────────────────
    simRef.current.nodes(nodes)
    simRef.current.force('link').links(links)
    simRef.current.force('charge').strength(d => {
      if (d.type === 'live_memory') return -45
      if (d.type === 'claude_memory') return -60
      const c = connCount.get(d.id) || 0
      if (c >= 3) return -170
      return -100
    })

    // If new nodes were added, warm up simulation briefly (no full reset)
    if (addedIds.size > 0) {
      simRef.current.alpha(0.3).restart()
    } else if (nodes.length !== prevIds.size) {
      simRef.current.alpha(0.2).restart()
    }

    // ── Claude project panels: update on tick ────────────────────────────
    // Re-draw convex hull halos around each project's nodes on every tick
    if (showClaude) {
      simRef.current.on('tick.panels', () => {
        if (!gRef.current) return
        const panelLayer = gRef.current.select('.panel-layer')
        if (panelLayer.empty()) return

        // Group claude nodes by project
        const byProject = {}
        nodes.filter(n => n.type === 'claude_memory').forEach(n => {
          if (n.x == null || n.y == null) return
          ;(byProject[n.project] = byProject[n.project] || []).push([n.x, n.y])
        })

        const projectNames = Object.keys(byProject)
        panelLayer.selectAll('.project-panel').data(projectNames, d => d)
          .join(
            enter => {
              const g = enter.append('g').attr('class', 'project-panel')
              g.append('ellipse').attr('class', 'panel-bg').style('pointer-events', 'none')
              g.append('text').attr('class', 'panel-label').style('pointer-events', 'none')
              return g
            },
            update => update,
            exit => exit.remove()
          )
          .each(function(pName) {
            const pts = byProject[pName]
            if (!pts?.length) return
            const hash = [...pName].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
            const hue  = Math.abs(hash) % 360

            // Bounding box center + radii
            const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
            const minX = Math.min(...xs), maxX = Math.max(...xs)
            const minY = Math.min(...ys), maxY = Math.max(...ys)
            const cx2 = (minX + maxX) / 2, cy2 = (minY + maxY) / 2
            const rx = Math.max((maxX - minX) / 2 + 40, 50)
            const ry = Math.max((maxY - minY) / 2 + 35, 40)

            d3.select(this).select('.panel-bg')
              .attr('cx', cx2).attr('cy', cy2)
              .attr('rx', rx).attr('ry', ry)
              .attr('fill', `hsla(${hue}, 55%, 12%, 0.35)`)
              .attr('stroke', `hsl(${hue}, 60%, 45%)`)
              .attr('stroke-width', 1)
              .attr('stroke-dasharray', '4 3')
              .attr('stroke-opacity', 0.6)

            d3.select(this).select('.panel-label')
              .attr('x', cx2).attr('y', cy2 - ry + 14)
              .attr('text-anchor', 'middle')
              .attr('fill', `hsl(${hue}, 80%, 70%)`)
              .attr('font-size', '10px')
              .attr('font-family', 'JetBrains Mono, monospace')
              .attr('opacity', 0.85)
              .text(pName)
          })
      })
    } else {
      simRef.current.on('tick.panels', null)
      if (gRef.current) gRef.current.select('.panel-layer').selectAll('*').remove()
    }

  }, [notes, liveMemories, claudeNodes, claudeLinks, showNotes, showLiveMemories, showClaude, buildGraph])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simRef.current?.stop()
      pulseRef.current?.stop()
      initDoneRef.current = false
    }
  }, [])

  const handleAction = useCallback(async (action, node) => {
    setContextMenu(null)
    if (action === 'edit') { setActiveNote(node.id); onClose() }
    else if (action === 'open-url') window.open(node.url, '_blank', 'noopener')
    else if (action === 'copy-url') navigator.clipboard.writeText(node.url).catch(() => {})
    else if (action === 'delete') {
      if (node.type === 'live_memory') await deleteLiveMemory(node.id)
      else await deleteNote(node.id)
    } else if (action === 'create-from') {
      if (node.type === 'live_memory') {
        await createNote(`Link: ${node.title || node.url}`, null, `# Link: ${node.title || node.url}\n\n[Abrir link](${node.url})\n`)
        onClose()
      } else {
        await createNote(`Cópia de ${node.title}`, null, ''); onClose()
      }
    }
  }, [setActiveNote, onClose, deleteLiveMemory, deleteNote, createNote])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#00000a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #00d4ff18', background: '#00000f' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#00e5ff', fontSize: 18, filter: 'drop-shadow(0 0 6px #00e5ff)' }}>⬡</span>
          <span style={{ color: '#b2ebf2', fontFamily: 'JetBrains Mono, monospace' }} className="text-sm font-semibold tracking-wide">
            Grafo de Conhecimento
          </span>
          <span style={{ color: '#004d5c', fontFamily: 'JetBrains Mono, monospace' }} className="text-xs ml-1">
            {showNotes ? notes.length : 0} notas
            {showLiveMemories ? ` · ${liveMemories.length} links` : ''}
            {showClaude && claudeNodes?.length ? ` · ${claudeNodes.length} memórias` : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
            style={{ color: '#4dd0e1', fontFamily: 'JetBrains Mono, monospace' }}>
            <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)}
              className="w-3 h-3" style={{ accentColor: '#00e5ff' }} />
            <FileText size={11} /> Notas
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
            style={{ color: '#4dd0e1', fontFamily: 'JetBrains Mono, monospace' }}>
            <input type="checkbox" checked={showLiveMemories} onChange={e => setShowLiveMemories(e.target.checked)}
              className="w-3 h-3" style={{ accentColor: '#1a6fff' }} />
            <Link size={11} /> Live
          </label>
          {settings?.extra?.trackClaudeMemory && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
              style={{ color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace' }}>
              <input type="checkbox" checked={showClaude} onChange={e => setShowClaude(e.target.checked)}
                className="w-3 h-3" style={{ accentColor: '#a78bfa' }} />
              <Brain size={11} /> Claude
            </label>
          )}
          <span className="text-xs hidden md:block"
            style={{ color: '#003344', fontFamily: 'JetBrains Mono, monospace' }}>
            Arraste · Scroll = zoom · Duplo clique = abrir
          </span>
          <button onClick={onClose}
            className="p-1.5 rounded transition-colors" style={{ color: '#4dd0e1' }}
            onMouseOver={e => e.currentTarget.style.background = '#00d4ff18'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Claude projects bar — shown when trackClaude is on */}
      {trackClaude && (
        <div className="flex items-center gap-2 px-4 py-1.5 flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: '1px solid #a78bfa18', background: '#06000e' }}>
          <Brain size={10} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <span className="text-[9px] mr-1 flex-shrink-0" style={{ color: '#4a3a80', fontFamily: 'JetBrains Mono, monospace' }}>
            Claude Memory
          </span>
          {claudeProjects.length === 0 ? (
            <span className="text-[9px]" style={{ color: '#3a2a60', fontFamily: 'JetBrains Mono, monospace' }}>
              Carregando projetos…
            </span>
          ) : claudeProjects.map(p => {
            const hash = [...p.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
            const hue  = Math.abs(hash) % 360
            const count = (claudeNodes || []).filter(n => n.project === p.name).length
            return (
              <span key={p.name} className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                style={{
                  background: `hsla(${hue}, 60%, 20%, 0.6)`,
                  border: `1px solid hsl(${hue}, 55%, 40%)`,
                  color: `hsl(${hue}, 80%, 75%)`,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                {p.name}
                <span style={{ opacity: 0.6 }}>({count || p.sessions})</span>
              </span>
            )
          })}
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="ml-auto flex-shrink-0 flex items-center gap-1 text-[9px] px-2 py-0.5 rounded transition-all"
            style={{
              background: syncingAll ? '#1a0a30' : '#2a1050',
              border: '1px solid #a78bfa44',
              color: syncingAll ? '#4a3a80' : '#c4b5fd',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <RefreshCw size={8} className={syncingAll ? 'animate-spin' : ''} />
            {syncingAll ? 'Sincronizando…' : 'SYNC ALL'}
          </button>
        </div>
      )}

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden"
        style={{ perspective: '1600px', perspectiveOrigin: '50% 42%' }}>
        <svg ref={svgRef} className="w-full h-full"
          style={{
            background: '#00000a',
            transform: 'rotateX(5deg)',
            transformOrigin: '50% 50%',
            display: 'block',
          }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 p-3 rounded-lg text-xs"
          style={{
            background: 'rgba(0,2,14,0.90)',
            border: '1px solid #00d4ff1a',
            fontFamily: 'JetBrains Mono, monospace',
            boxShadow: '0 0 20px #00d4ff0a',
          }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00ffff', boxShadow: '0 0 8px #00ffff, 0 0 2px #fff' }} />
            <span style={{ color: '#80deea' }}>Hub (3+ links)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00b8d9', boxShadow: '0 0 6px #00b8d9' }} />
            <span style={{ color: '#4dd0e1' }}>Conectado</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00526a' }} />
            <span style={{ color: '#1a5a6a' }}>Isolado</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1a6fff', boxShadow: '0 0 6px #1a6fff' }} />
            <span style={{ color: '#5b8fff' }}>Live Memory</span>
          </div>
          {settings?.extra?.trackClaudeMemory && (
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
              <span style={{ color: '#c4b5fd' }}>Claude Memory</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 text-xs"
          style={{
            background: 'rgba(0,2,14,0.75)', borderRadius: 6, padding: '4px 10px',
            border: '1px solid #00d4ff12', color: '#003344', fontFamily: 'JetBrains Mono, monospace',
          }}>
          Clique direito para opções
        </div>
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onAction={handleAction} />
      <Tooltip tooltip={tooltip} />
    </div>
  )
}

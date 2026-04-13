import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useNotesStore } from '../store/useNotesStore'

// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  neural: {
    name: 'Neural',
    bg: '#000a0f',
    panelBg: 'transparent',
    panelBorder: 'rgba(0,180,220,0.10)',
    panelLabel: 'rgba(0,200,240,0.45)',
    nodeHigh: '#00ffff', nodeMid: '#00b8d9', nodeLow: '#003d4d',
    linkNote: '#00a0c0', linkDomain: 'rgba(0,180,220,0.35)',
    particle: '#00ffcc',
    label: '#1a5a6a', labelHigh: '#80deea',
  },
  synthwave: {
    name: 'Synthwave',
    bg: '#0a0010',
    panelBg: 'transparent',
    panelBorder: 'rgba(200,0,240,0.10)',
    panelLabel: 'rgba(220,80,255,0.45)',
    nodeHigh: '#ff40ff', nodeMid: '#9900cc', nodeLow: '#280038',
    linkNote: '#cc00ee', linkDomain: 'rgba(180,0,220,0.35)',
    particle: '#ff80ff',
    label: '#8844aa', labelHigh: '#f0a0e0',
  },
  matrix: {
    name: 'Matrix',
    bg: '#000800',
    panelBg: 'transparent',
    panelBorder: 'rgba(0,200,60,0.10)',
    panelLabel: 'rgba(0,220,80,0.45)',
    nodeHigh: '#00ff41', nodeMid: '#00aa2b', nodeLow: '#001800',
    linkNote: '#00bb33', linkDomain: 'rgba(0,180,50,0.35)',
    particle: '#80ffaa',
    label: '#1e5520', labelHigh: '#88ff99',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashStr(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0
  return h
}

function domainColors(domain) {
  const hue = hashStr(domain) % 360
  return {
    fill:      `hsl(${hue},60%,18%)`,
    stroke:    `hsl(${hue},80%,50%)`,
    glow:      `hsl(${hue},90%,52%)`,
    label:     `hsl(${hue},70%,62%)`,
    urlFill:   `hsl(${hue},45%,12%)`,
    urlStroke: `hsl(${hue},55%,30%)`,
    link:      `hsl(${hue},65%,40%)`,
  }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'unknown' }
}

const STOP = new Set([
  'http','https','www','com','net','org','the','and','for','are','was','not','you','all','can',
  'has','his','how','its','new','see','who','did','does','from','into','some','than','that',
  'them','then','they','this','with','have','been','will','your','more','when','what','time',
  'very','over','such','just','like','only','also','most','both','each','much','after','about',
  'html','page','home','news','blog','site','web','read','2024','2025','2026',
])
function extractKeywords(text) {
  return [...new Set(
    (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 4 && !STOP.has(w))
  )]
}

// ─── Keyword clustering for URL nodes ────────────────────────────────────────
// Uses union-find so all transitively connected nodes share the same clusterKey.
// Returns { nodeCluster: Map<id,clusterKey>, urlKwSets: Map<id,Set<kw>> }
function buildKeywordClusters(urlNodes) {
  const urlKwSets = new Map()
  urlNodes.forEach(n => {
    urlKwSets.set(n.id, new Set(extractKeywords((n.title || '') + ' ' + (n.url || ''))))
  })

  // Union-Find
  const parent = new Map(urlNodes.map(n => [n.id, n.id]))
  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)))
    return parent.get(x)
  }
  function union(x, y) {
    const px = find(x), py = find(y)
    if (px !== py) parent.set(px, py)  // merge: py becomes root
  }

  // Connect nodes that share >= 1 keyword
  for (let i = 0; i < urlNodes.length; i++) {
    const a = urlNodes[i], setA = urlKwSets.get(a.id)
    for (let j = i + 1; j < urlNodes.length; j++) {
      const b = urlNodes[j], setB = urlKwSets.get(b.id)
      if ([...setA].some(w => setB.has(w))) union(a.id, b.id)
    }
  }

  // Assign clusterKey = root; only nodes that belong to a cluster with 2+ members
  const rootCount = new Map()
  urlNodes.forEach(n => {
    const r = find(n.id)
    rootCount.set(r, (rootCount.get(r) || 0) + 1)
  })

  const nodeCluster = new Map()
  urlNodes.forEach(n => {
    const r = find(n.id)
    if (rootCount.get(r) >= 2) nodeCluster.set(n.id, r)
  })

  return { nodeCluster, urlKwSets }
}

function clusterColors(clusterKey) {
  const hue = hashStr(clusterKey) % 360
  return {
    fill:   `hsl(${hue},55%,15%)`,
    stroke: `hsl(${hue},75%,42%)`,
    glow:   `hsl(${hue},85%,50%)`,
    label:  `hsl(${hue},65%,58%)`,
  }
}

// Node radius — no giant nodes
function nodeBaseR(d, connCount) {
  if (d.type === 'domain')       return 4 + Math.min((connCount.get(d.id) || 0) * 0.25, 3.5)
  if (d.type === 'live_memory')  return 2.2
  if (d.type === 'claude_memory') return 3.5
  // note
  const c = connCount.get(d.id) || 0
  return 3 + Math.min(c * 0.8, 4.5)
}

// ─── Panel layout ─────────────────────────────────────────────────────────────
// Arrange panels in a grid given canvas size.
// Returns array of { id, label, x, y, w, h }
function buildPanelLayout(panelDefs, canvasW, canvasH) {
  const count  = panelDefs.length
  const pad    = 18   // outer margin
  const gap    = 16   // gap between panels

  // Determine grid columns: try to keep panels roughly square
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4
  const rows = Math.ceil(count / cols)

  const totalW = canvasW - pad * 2
  const totalH = canvasH - pad * 2
  const cellW  = (totalW - gap * (cols - 1)) / cols
  const cellH  = (totalH - gap * (rows - 1)) / rows

  return panelDefs.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      ...p,
      x: pad + col * (cellW + gap),
      y: pad + row * (cellH + gap),
      w: cellW,
      h: cellH,
      cx: pad + col * (cellW + gap) + cellW / 2,
      cy: pad + row * (cellH + gap) + cellH / 2,
    }
  })
}

// ─── InlineGraph ──────────────────────────────────────────────────────────────
export default function InlineGraph() {
  const svgRef   = useRef(null)
  const stateRef = useRef({
    sim: null, g: null, nodeG: null, linkG: null,
    pulseTimer: null, particleInterval: null,
    lmIds: new Set(), domainNodes: new Map(), domainKeywords: new Map(),
    allNodes: [], allLinks: [], connCount: new Map(),
    panels: [], theme: null, setActiveNote: null,
  })
  const [themeName, setThemeName] = useState('neural')

  const FILTER_KEY = 'graph-inline-filters'
  const savedFilters = (() => { try { return JSON.parse(localStorage.getItem(FILTER_KEY)) } catch { return null } })()
  const [filterNotes, setFilterNotes]         = useState(savedFilters?.notes      ?? true)
  const [filterLiveMemory, setFilterLiveMemory] = useState(savedFilters?.live_memory ?? false)
  const [filterClaude, setFilterClaude]       = useState(savedFilters?.claude     ?? false)

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ notes: filterNotes, live_memory: filterLiveMemory, claude: filterClaude }))
  }, [filterNotes, filterLiveMemory, filterClaude])

  const { notes, setActiveNote, getLinks, fetchLiveMemories, user } = useNotesStore()
  const folders          = useNotesStore(s => s.folders)
  const liveMemories     = useNotesStore(s => s.liveMemories)
  const claudeNodes      = useNotesStore(s => s.claudeNodes)
  const claudeProjects   = useNotesStore(s => s.claudeProjects)
  const settings         = useNotesStore(s => s.settings)
  const fetchClaudeProjects = useNotesStore(s => s.fetchClaudeProjects)
  const fetchClaudeNodes    = useNotesStore(s => s.fetchClaudeNodes)
  const syncClaudeProject   = useNotesStore(s => s.syncClaudeProject)
  const trackClaude = settings?.extra?.trackClaudeMemory

  useEffect(() => { if (user) fetchLiveMemories({ limit: 500 }) }, [user])

  // Auto-load + auto-sync claude projects when graph opens
  useEffect(() => {
    if (!user || !trackClaude) return
    const autoSync = async () => {
      await fetchClaudeProjects()
      await fetchClaudeNodes()
      const projects = useNotesStore.getState().claudeProjects || []
      const nodes    = useNotesStore.getState().claudeNodes    || []
      const synced   = new Set(nodes.map(n => n.project))
      const needSync = projects.filter(p => !synced.has(p.name))
      for (const p of needSync) await syncClaudeProject(p.name)
    }
    autoSync()
  }, [user, trackClaude])

  // ── Full rebuild ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const st = stateRef.current

    const theme  = THEMES[themeName]
    const width  = el.clientWidth  || 900
    const height = el.clientHeight || 550

    st.setActiveNote = setActiveNote

    // Reset lookup maps (rebuilt every run for both paths)
    st.lmIds = new Set(); st.domainNodes = new Map(); st.domainKeywords = new Map()

    // ── Build all candidate nodes & links ────────────────────────────────────
    const folderMap = new Map((folders || []).map(f => [f.id, f]))

    // Walk up folder tree to find root ancestor
    const getRootFolderId = (folderId) => {
      let cur = folderId
      for (let i = 0; i < 20; i++) {
        const f = folderMap.get(cur)
        if (!f || !f.parent_id) return cur
        cur = f.parent_id
      }
      return cur
    }

    const notesByFolder = new Map()
    ;(notes || []).forEach(n => {
      const fid = n.folder_id ? getRootFolderId(n.folder_id) : '__unfiled__'
      if (!notesByFolder.has(fid)) notesByFolder.set(fid, [])
      notesByFolder.get(fid).push(n)
    })

    const { byDomain, domainKeywords, domainLinks } = buildLiveGraph(filterLiveMemory ? liveMemories : [])
    const allLinks = []

    // Domain + URL nodes (tentative panelId = 'live_memory')
    const domainNodeList = [], urlNodeList = []
    byDomain.forEach((urls, domain) => {
      const domId   = `domain:${domain}`
      const domNode = { id: domId, domain, title: domain, type: 'domain', panelId: 'live_memory',
        x: width/2 + (Math.random()-0.5)*80, y: height/2 + (Math.random()-0.5)*80 }
      domainNodeList.push(domNode)
      st.domainNodes.set(domain, domNode)
      urls.forEach(m => {
        st.lmIds.add(m.id)
        const urlNode = { id: m.id, title: m.title || domain, url: m.url, domain,
          type: 'live_memory', panelId: 'live_memory',
          x: domNode.x + (Math.random()-0.5)*30, y: domNode.y + (Math.random()-0.5)*30 }
        urlNodeList.push(urlNode)
        allLinks.push({ source: m.id, target: domId, ltype: 'url_to_domain' })
      })
    })
    st.domainKeywords = domainKeywords
    domainLinks.forEach(l => allLinks.push(l))

    // Keyword clusters
    const { nodeCluster: kwClusters, urlKwSets } = buildKeywordClusters(urlNodeList)
    urlNodeList.forEach(n => { n.clusterKey = kwClusters.get(n.id) || null })
    for (let i = 0; i < urlNodeList.length; i++) {
      const a = urlNodeList[i], setA = urlKwSets.get(a.id)
      for (let j = i + 1; j < urlNodeList.length; j++) {
        const b = urlNodeList[j], setB = urlKwSets.get(b.id)
        const shared = [...setA].filter(w => setB.has(w))
        if (shared.length >= 1)
          allLinks.push({ source: a.id, target: b.id, ltype: 'kw_cluster', sharedWords: shared })
      }
    }

    // Note nodes (panelId = root ancestor folder)
    const noteNodes = (filterNotes ? (notes || []) : []).map(n => {
      const fid = n.folder_id ? getRootFolderId(n.folder_id) : '__unfiled__'
      return { id: n.id, title: n.title, type: 'note', content: n.content, panelId: fid,
        x: width/2 + (Math.random()-0.5)*80, y: height/2 + (Math.random()-0.5)*80 }
    })
    const noteMap = new Map((notes || []).map(n => [n.title?.toLowerCase(), n]))
    ;(notes || []).forEach(note => {
      getLinks(note.content || '').forEach(title => {
        const target = noteMap.get(title.toLowerCase())
        if (target) allLinks.push({ source: note.id, target: target.id, ltype: 'note' })
      })
    })

    // Claude Memory nodes (one panel per project)
    const claudeNodeList = []
    if (trackClaude && filterClaude && claudeNodes?.length) {
      claudeNodes.forEach(cn => {
        claudeNodeList.push({
          id: cn.id,
          title: cn.summary,
          project: cn.project,
          type: 'claude_memory',
          panelId: `claude:${cn.project}`,
          x: width / 2 + (Math.random() - 0.5) * 80,
          y: height / 2 + (Math.random() - 0.5) * 80,
        })
      })
      // Links between claude nodes of same project
      const byProject = new Map()
      claudeNodeList.forEach(n => {
        if (!byProject.has(n.project)) byProject.set(n.project, [])
        byProject.get(n.project).push(n.id)
      })
      byProject.forEach(ids => {
        for (let i = 1; i < ids.length; i++)
          allLinks.push({ source: ids[0], target: ids[i], ltype: 'claude' })
      })
    }

    // ── Count nodes per tentative panel, keep panels with 2+ nodes ───────────
    const allCandidates = [...domainNodeList, ...urlNodeList, ...noteNodes, ...claudeNodeList]
    const nodesPerPanel = new Map()
    allCandidates.forEach(n => {
      nodesPerPanel.set(n.panelId, (nodesPerPanel.get(n.panelId) || 0) + 1)
    })

    // Build panelDefs only for panels with 2+ nodes
    const panelDefs = []
    if ((nodesPerPanel.get('live_memory') || 0) >= 2)
      panelDefs.push({ id: 'live_memory', label: 'Live Memory', type: 'live_memory' })
    if (trackClaude && filterClaude) {
      const claudeProjectNames = claudeProjects?.length
        ? claudeProjects.map(p => p.name)
        : [...new Set((claudeNodes || []).map(n => n.project))]
      claudeProjectNames.forEach(pName => {
        const pid = `claude:${pName}`
        if ((nodesPerPanel.get(pid) || 0) >= 2)
          panelDefs.push({ id: pid, label: `⬡ ${pName}`, type: 'claude' })
      })
    }
    notesByFolder.forEach((_, fid) => {
      if ((nodesPerPanel.get(fid) || 0) < 2) return
      if (fid === '__unfiled__') {
        panelDefs.push({ id: '__unfiled__', label: 'Notas', type: 'notes' })
      } else {
        const f = folderMap.get(fid)
        panelDefs.push({ id: fid, label: f?.name || 'Pasta', type: 'notes', folderId: fid })
      }
    })

    const panels = buildPanelLayout(panelDefs, width, height)
    const panelById = new Map(panels.map(p => [p.id, p]))

    // Nodes in panels with 2+ notes stay inside their panel.
    // Nodes outside panels (solo/unfiled) only appear if they have at least one link.
    const validPanelIds = new Set(panels.map(p => p.id))
    const linkedNodeIds = new Set()
    allLinks.forEach(l => {
      linkedNodeIds.add(typeof l.source === 'object' ? l.source.id : l.source)
      linkedNodeIds.add(typeof l.target === 'object' ? l.target.id : l.target)
    })
    const candidatesWithPanel = allCandidates.map(n => {
      if (!validPanelIds.has(n.panelId)) return { ...n, panelId: null }
      return n
    }).filter(n => n.panelId !== null || linkedNodeIds.has(n.id))

    const allNodes = candidatesWithPanel
    allNodes.forEach(n => {
      const p = n.panelId ? panelById.get(n.panelId) : null
      if (p) {
        n.x = p.cx + (Math.random()-0.5) * p.w * 0.55
        n.y = p.cy + (Math.random()-0.5) * p.h * 0.55
      } else {
        n.x = width * (0.1 + Math.random() * 0.8)
        n.y = height * (0.1 + Math.random() * 0.8)
      }
    })
    const validNodeIds = new Set(allNodes.map(n => n.id))
    const filteredLinks = allLinks.filter(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source
      const tid = typeof l.target === 'object' ? l.target.id : l.target
      return validNodeIds.has(sid) && validNodeIds.has(tid)
    })

    const connCount = new Map(allNodes.map(n => [n.id, 0]))
    filteredLinks.forEach(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source
      const tid = typeof l.target === 'object' ? l.target.id : l.target
      if (connCount.has(sid)) connCount.set(sid, (connCount.get(sid) || 0) + 1)
      if (connCount.has(tid)) connCount.set(tid, (connCount.get(tid) || 0) + 1)
    })

    const allLinks2 = filteredLinks

    // ── Incremental update path (no SVG rebuild) ─────────────────────────────
    const newPanelKey = panels.map(p => p.id).sort().join(',')
    const prevPanelKey = (st.panels || []).map(p => p.id).sort().join(',')

    if (st.sim && st.nodeG && st.linkG && newPanelKey === prevPanelKey && st.theme === theme) {
      // Preserve positions of existing nodes
      const prevById = new Map((st.allNodes || []).map(n => [n.id, n]))
      allNodes.forEach(n => {
        const prev = prevById.get(n.id)
        if (prev) { n.x = prev.x; n.y = prev.y; n.vx = prev.vx || 0; n.vy = prev.vy || 0 }
      })

      st.allNodes = allNodes; st.allLinks = allLinks2; st.connCount = connCount
      st.panels = panels; st.panelById = panelById  // keep panelForce in sync

      // Update simulation
      st.sim.nodes(allNodes)
      st.sim.force('link').links(allLinks2)
      st.sim.alpha(0.18).restart()

      // D3 join — nodes
      const grpSel = st.nodeG.selectAll('g').data(allNodes, d => d.id)
      grpSel.exit().transition().duration(350).style('opacity', 0).remove()
      const grpEnter = grpSel.enter().append('g')
      appendNodeVisuals(grpEnter, connCount, theme, true)
      attachNodeInteractions(grpEnter, st.sim, connCount, stateRef)

      // D3 join — hier links
      const hierLinks = allLinks2.filter(l => l.ltype !== 'kw_cluster')
      const linkKey = d => {
        const s = typeof d.source === 'object' ? d.source.id : d.source
        const t = typeof d.target === 'object' ? d.target.id : d.target
        return `${s}--${t}`
      }
      st.linkG.selectAll('path.hier').data(hierLinks, linkKey)
        .join(
          enter => enter.insert('path', ':first-child')
            .attr('class', 'hier').attr('fill', 'none')
            .attr('stroke', d => {
              if (d.ltype === 'url_to_domain') {
                const src = allNodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source))
                if (src?.clusterKey) return clusterColors(src.clusterKey).stroke
                const dom = typeof d.source === 'object' ? d.source.domain : null
                return dom ? domainColors(dom).link : theme.linkDomain
              }
              if (d.ltype === 'domain_link') return theme.linkDomain
              if (d.ltype === 'claude')      return 'hsl(270,60%,50%)'
              return theme.linkNote
            })
            .attr('stroke-width', d => d.ltype === 'note' ? 0.8 : 0.5)
            .attr('stroke-opacity', 0)
            .attr('filter', d => d.ltype === 'note' ? 'url(#bloom-soft)' : null)
            .transition().duration(700)
            .attr('stroke-opacity', d => {
              if (d.ltype === 'url_to_domain') return 0.18
              if (d.ltype === 'domain_link')   return 0.30
              if (d.ltype === 'claude')        return 0.45
              return 0.48
            }),
          update => update,
          exit => exit.transition().duration(350).attr('stroke-opacity', 0).remove()
        )

      return // skip full rebuild
    }

    st.allNodes = allNodes; st.allLinks = allLinks2; st.connCount = connCount; st.panels = panels; st.panelById = panelById; st.theme = theme

    // Stop previous simulation before full SVG rebuild
    if (st.sim)             { st.sim.stop(); st.sim = null }
    if (st.pulseTimer)      { st.pulseTimer.stop(); st.pulseTimer = null }
    if (st.particleInterval){ clearInterval(st.particleInterval); st.particleInterval = null }

    // ── SVG ───────────────────────────────────────────────────────────────────
    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('width', width).attr('height', height)

    // Defs
    const defs = svg.append('defs')

    const makeBloom = (id, dev, slope) => {
      const f = defs.append('filter').attr('id', id)
        .attr('x', '-150%').attr('y', '-150%').attr('width', '400%').attr('height', '400%')
      f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', dev).attr('result', 'blur')
      if (slope > 1) {
        const ct = f.append('feComponentTransfer').attr('in', 'blur').attr('result', 'bright')
        ct.append('feFuncR').attr('type', 'linear').attr('slope', slope)
        ct.append('feFuncG').attr('type', 'linear').attr('slope', slope)
        ct.append('feFuncB').attr('type', 'linear').attr('slope', slope)
        const m = f.append('feMerge')
        m.append('feMergeNode').attr('in', 'bright')
        m.append('feMergeNode').attr('in', 'SourceGraphic')
      } else {
        const m = f.append('feMerge')
        m.append('feMergeNode').attr('in', 'blur')
        m.append('feMergeNode').attr('in', 'SourceGraphic')
      }
    }
    makeBloom('bloom-strong', 6, 4)
    makeBloom('bloom-soft',   3, 1)

    byDomain.forEach((_, domain) => {
      const hue = hashStr(domain) % 360
      const safe = domain.replace(/[^a-z0-9]/g, '-')
      const f = defs.append('filter').attr('id', `dglow-${safe}`)
        .attr('x', '-120%').attr('y', '-120%').attr('width', '340%').attr('height', '340%')
      f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 4).attr('result', 'blur')
      f.append('feFlood').attr('flood-color', `hsl(${hue},90%,55%)`).attr('flood-opacity', 1).attr('result', 'col')
      f.append('feComposite').attr('in', 'col').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow')
      const m = f.append('feMerge')
      m.append('feMergeNode').attr('in', 'glow')
      m.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.1, 6]).on('zoom', e => g.attr('transform', e.transform)))
    st.g = g

    // ── Draw panels ───────────────────────────────────────────────────────────
    const panelG = g.append('g').attr('class', 'panels').style('pointer-events', 'none')
    panels.forEach(p => {
      const pg = panelG.append('g')
      const isClaude = p.type === 'claude'
      pg.append('rect')
        .attr('x', p.x).attr('y', p.y).attr('width', p.w).attr('height', p.h)
        .attr('rx', 10).attr('ry', 10)
        .attr('fill', isClaude ? 'rgba(80,30,120,0.12)' : theme.panelBg)
        .attr('stroke', isClaude ? 'rgba(167,139,250,0.35)' : theme.panelBorder)
        .attr('stroke-width', isClaude ? 1.2 : 1)
        .attr('stroke-dasharray', isClaude ? '5 3' : null)

      // Panel label at top-left
      pg.append('text')
        .attr('x', p.x + 12).attr('y', p.y + 16)
        .attr('fill', isClaude ? 'rgba(196,181,253,0.75)' : theme.panelLabel)
        .attr('font-size', '9px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-weight', 'bold')
        .attr('letter-spacing', '0.08em')
        .text(p.label.toUpperCase())
    })

    // ── Birth flash ───────────────────────────────────────────────────────────
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, s = 20 + Math.random() * 60
      const col = Math.random() > 0.5 ? theme.nodeHigh : theme.nodeMid
      const cx0 = width / 2, cy0 = height / 2
      g.append('circle').attr('cx', cx0).attr('cy', cy0).attr('r', 1 + Math.random() * 1.5)
        .attr('fill', col).attr('opacity', 0.8).style('pointer-events', 'none')
        .transition().duration(400 + Math.random() * 500).ease(d3.easeQuadOut)
        .attr('cx', cx0 + Math.cos(a) * s).attr('cy', cy0 + Math.sin(a) * s).attr('opacity', 0)
        .on('end', function() { d3.select(this).remove() })
    }

    // ── Panel-anchoring force ─────────────────────────────────────────────────
    // panelForce reads from stateRef so incremental updates pick up new nodes/panels
    const panelForce = alpha => {
      const { allNodes: nodes, panelById: pById } = stateRef.current
      if (!nodes || !pById) return
      nodes.forEach(n => {
        const p = pById.get(n.panelId)
        if (!p) return
        n.vx = (n.vx || 0) + (p.cx - (n.x || 0)) * alpha * 0.06
        n.vy = (n.vy || 0) + (p.cy - (n.y || 0)) * alpha * 0.06
        const margin = 10
        if ((n.x || 0) < p.x + margin)       n.vx = (n.vx || 0) + (p.x + margin - (n.x || 0)) * alpha * 1.5
        if ((n.x || 0) > p.x + p.w - margin) n.vx = (n.vx || 0) + (p.x + p.w - margin - (n.x || 0)) * alpha * 1.5
        if ((n.y || 0) < p.y + margin)       n.vy = (n.vy || 0) + (p.y + margin - (n.y || 0)) * alpha * 1.5
        if ((n.y || 0) > p.y + p.h - margin) n.vy = (n.vy || 0) + (p.y + p.h - margin - (n.y || 0)) * alpha * 1.5
      })
    }

    // ── Force simulation ──────────────────────────────────────────────────────
    const sim = d3.forceSimulation(allNodes)
      .alphaDecay(0.025)
      .velocityDecay(0.55)
      .force('link', d3.forceLink(allLinks2).id(d => d.id)
        .distance(d => {
          if (d.ltype === 'url_to_domain') return 22
          if (d.ltype === 'domain_link')   return 70
          if (d.ltype === 'kw_cluster')    return 18
          return 45
        })
        .strength(d => {
          if (d.ltype === 'url_to_domain') return 0.9
          if (d.ltype === 'domain_link')   return 0.15
          // Same-domain kw links are very numerous on sites like YouTube — use low strength
          if (d.ltype === 'kw_cluster') {
            const sid = typeof d.source === 'object' ? d.source.domain : null
            const tid = typeof d.target === 'object' ? d.target.domain : null
            return (sid && sid === tid) ? 0.1 : 0.35
          }
          return 0.5
        }))
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'domain')      return -55
        if (d.type === 'live_memory') return -8
        return -40
      }))
      .force('collision', d3.forceCollide(d => nodeBaseR(d, connCount) + 2.5))
      .force('panel', panelForce)
      .alpha(1.0)

    st.sim = sim

    // ── Link layer ────────────────────────────────────────────────────────────
    const linkG = g.append('g').attr('class', 'links')
    st.linkG = linkG

    // Tooltip element (shared across all link hovers)
    const tooltip = g.append('g').attr('class', 'kw-tooltip').style('pointer-events', 'none').attr('opacity', 0)
    const tooltipBg   = tooltip.append('rect').attr('rx', 4).attr('fill', 'rgba(0,0,0,0.82)').attr('stroke', theme.panelBorder)
    const tooltipText = tooltip.append('text').attr('fill', theme.labelHigh).attr('font-size', '8px')
      .attr('font-family', 'JetBrains Mono, monospace').attr('text-anchor', 'middle')
    st.tooltip = tooltip

    // Non-cluster links
    linkG.selectAll('path.hier').data(allLinks.filter(l => l.ltype !== 'kw_cluster')).join('path')
      .attr('class', 'hier')
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.ltype === 'url_to_domain') {
          const srcNode = allNodes.find(n => n.id === (typeof d.source === 'object' ? d.source.id : d.source))
          if (srcNode?.clusterKey) return clusterColors(srcNode.clusterKey).stroke
          const dom = typeof d.source === 'object' ? d.source.domain : null
          return dom ? domainColors(dom).link : theme.linkDomain
        }
        if (d.ltype === 'domain_link') return theme.linkDomain
        if (d.ltype === 'claude')      return 'hsl(270,60%,50%)'
        return theme.linkNote
      })
      .attr('stroke-width', d => d.ltype === 'note' ? 0.8 : d.ltype === 'domain_link' ? 0.7 : 0.5)
      .attr('stroke-opacity', 0)
      .attr('filter', d => d.ltype === 'note' ? 'url(#bloom-soft)' : null)
      .transition().delay(900).duration(800)
      .attr('stroke-opacity', d => {
        if (d.ltype === 'url_to_domain') return 0.18
        if (d.ltype === 'domain_link')   return 0.30
        if (d.ltype === 'claude')        return 0.45
        return 0.48
      })

    // Keyword-cluster links (leaf ↔ leaf with shared words)
    const kwLinks = allLinks.filter(l => l.ltype === 'kw_cluster')

    // Visible thin dashed line
    linkG.selectAll('path.kw').data(kwLinks).join('path')
      .attr('class', 'kw')
      .attr('fill', 'none')
      .attr('stroke', d => {
        const src = typeof d.source === 'object' ? d.source : allNodes.find(n => n.id === d.source)
        return src?.clusterKey ? clusterColors(src.clusterKey).stroke : theme.nodeMid
      })
      .attr('stroke-width', 0.6)
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-opacity', 0)
      .style('pointer-events', 'none')
      .transition().delay(1200).duration(800).attr('stroke-opacity', 0.22)

    // Invisible fat path on top — only for mouse hit detection
    const showTooltip = (d) => {
      // highlight the matching visible path
      linkG.selectAll('path.kw').filter(l => l === d)
        .transition().duration(80).attr('stroke-opacity', 0.75).attr('stroke-width', 1.4)
      const words = (d.sharedWords || []).slice(0, 8).join('  ·  ')
      tooltipText.text(words)
      const bbox = tooltipText.node().getBBox()
      const pad = 6
      tooltipBg
        .attr('x', bbox.x - pad).attr('y', bbox.y - pad)
        .attr('width', bbox.width + pad * 2).attr('height', bbox.height + pad * 2)
      const sx = typeof d.source === 'object' ? (d.source.x || 0) : 0
      const sy = typeof d.source === 'object' ? (d.source.y || 0) : 0
      const tx = typeof d.target === 'object' ? (d.target.x || 0) : 0
      const ty = typeof d.target === 'object' ? (d.target.y || 0) : 0
      tooltip.attr('transform', `translate(${(sx + tx) / 2},${(sy + ty) / 2 - 16})`).attr('opacity', 1)
    }
    const hideTooltip = (d) => {
      linkG.selectAll('path.kw').filter(l => l === d)
        .transition().duration(200).attr('stroke-opacity', 0.22).attr('stroke-width', 0.6)
      tooltip.attr('opacity', 0)
    }

    linkG.selectAll('path.kw-hit').data(kwLinks).join('path')
      .attr('class', 'kw-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 9)
      .style('cursor', 'crosshair')
      .on('mouseover', function(_, d) { showTooltip(d) })
      .on('mouseout',  function(_, d) { hideTooltip(d) })

    // ── Node layer ────────────────────────────────────────────────────────────
    const nodeG = g.append('g').attr('class', 'nodes')
    st.nodeG = nodeG

    const nodeGrp = nodeG.selectAll('g').data(allNodes, d => d.id).join('g')
    appendNodeVisuals(nodeGrp, connCount, theme, false)
    attachNodeInteractions(nodeGrp, sim, connCount, stateRef)

    // ── Tick ──────────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      linkG.selectAll('path.hier, path.kw, path.kw-hit').attr('d', d => {
        const sx = d.source.x || 0, sy = d.source.y || 0
        const tx = d.target.x || 0, ty = d.target.y || 0
        const mx = (sx + tx) / 2 + (ty - sy) * 0.12
        const my = (sy + ty) / 2 - (tx - sx) * 0.12
        return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
      })
      nodeG.selectAll('g').attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
    })

    // ── Particle flow on note links ───────────────────────────────────────────
    const noteLinks = allLinks.filter(l => l.ltype === 'note')
    if (noteLinks.length > 0) {
      st.particleInterval = setInterval(() => {
        const l = noteLinks[Math.floor(Math.random() * noteLinks.length)]
        g.append('circle').attr('r', 1 + Math.random() * 1.5)
          .attr('fill', theme.particle).attr('filter', 'url(#bloom-soft)')
          .style('pointer-events', 'none')
          .transition().duration(900 + Math.random() * 1000).ease(d3.easeLinear)
          .tween('travel', function() {
            return t => {
              const sx = l.source.x || 0, sy = l.source.y || 0
              const tx = l.target.x || 0, ty = l.target.y || 0
              const mx = (sx + tx) / 2 + (ty - sy) * 0.25
              const my = (sy + ty) / 2 - (tx - sx) * 0.25
              d3.select(this)
                .attr('cx', (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*tx)
                .attr('cy', (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ty)
                .attr('opacity', Math.sin(t * Math.PI) * 0.9)
            }
          })
          .on('end', function() { d3.select(this).remove() })
      }, 420)
    }

    // ── Breathing pulse animation ─────────────────────────────────────────────
    let animT = 0
    st.pulseTimer = d3.timer(() => {
      animT += 0.012
      nodeG.selectAll('g').each(function(d) {
        const r    = nodeBaseR(d, connCount)
        const seed = hashStr(String(d.id)) * 0.004
        const pulse = Math.abs(Math.sin(animT * 0.85 + seed))

        const glowBase = d.type === 'live_memory' ? r * 2 : r * 3
        d3.select(this).select('.glow-vol')
          .attr('r', glowBase + pulse * r * 0.6)
          .attr('opacity', 0.03 + pulse * 0.04)
        d3.select(this).select('.main')
          .attr('r', r + Math.sin(animT * 1.1 + seed) * 0.2)
      })
    })

  }, [notes, folders, liveMemories, claudeNodes, claudeProjects, trackClaude, themeName, filterNotes, filterLiveMemory, filterClaude])

  // Cleanup on unmount only (incremental runs must not stop the running sim)
  useEffect(() => () => {
    const st = stateRef.current
    if (st.sim)             { st.sim.stop(); st.sim = null }
    if (st.pulseTimer)      { st.pulseTimer.stop(); st.pulseTimer = null }
    if (st.particleInterval){ clearInterval(st.particleInterval); st.particleInterval = null }
  }, [])

  const theme = THEMES[themeName]

  return (
    <div className="w-full h-full flex flex-col" style={{ background: theme.bg }}>
      {/* Toolbar */}
      <div className="px-4 py-1.5 text-xs flex items-center gap-3 flex-shrink-0"
        style={{
          borderBottom: `1px solid ${theme.panelBorder}`,
          color: theme.label,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
        <span style={{ fontSize: 13, filter: `drop-shadow(0 0 4px ${theme.nodeHigh})` }}>◈</span>
        <span style={{ color: theme.labelHigh }}>{(notes || []).length}</span>
        <span>notas ·</span>
        <span style={{ color: theme.labelHigh }}>{liveMemories.length}</span>
        <span>links</span>
        <span style={{ opacity: 0.3 }}>· Arraste · Scroll · Click · Duplo</span>
        {/* Filtros */}
        <div className="flex gap-1 items-center" style={{ borderLeft: `1px solid ${theme.panelBorder}`, paddingLeft: 8, marginLeft: 4 }}>
          <FilterChip label="Notas" active={filterNotes} onChange={setFilterNotes} color={theme.nodeHigh} />
          <FilterChip label="Links" active={filterLiveMemory} onChange={setFilterLiveMemory} color="#3b82f6" />
          {trackClaude && <FilterChip label="Claude" active={filterClaude} onChange={setFilterClaude} color="#a78bfa" />}
        </div>

        <div className="flex gap-1 ml-auto">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => setThemeName(key)} style={{
              padding: '2px 10px', borderRadius: 4, fontSize: 10,
              border: `1px solid ${themeName === key ? theme.nodeHigh + '66' : theme.panelBorder}`,
              background: themeName === key ? theme.nodeHigh + '18' : 'transparent',
              color: themeName === key ? theme.nodeHigh : theme.label,
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'JetBrains Mono, monospace',
              boxShadow: themeName === key ? `0 0 8px ${theme.nodeHigh}44` : 'none',
            }}>{t.name}</button>
          ))}
        </div>
      </div>
      <svg ref={svgRef} className="flex-1 w-full" />
    </div>
  )
}

// ─── buildLiveGraph ───────────────────────────────────────────────────────────
function buildLiveGraph(liveMemories) {
  const byDomain = new Map()
  liveMemories.forEach(m => {
    const d = getDomain(m.url)
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d).push(m)
  })
  const domainKeywords = new Map()
  byDomain.forEach((urls, domain) => {
    const words = new Set()
    urls.forEach(m => extractKeywords(m.title + ' ' + m.url).forEach(w => words.add(w)))
    domainKeywords.set(domain, words)
  })
  const domainLinks = []
  const domains = [...byDomain.keys()]
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const a = domains[i], b = domains[j]
      const shared = [...domainKeywords.get(b)].filter(w => domainKeywords.get(a).has(w))
      if (shared.length >= 2)
        domainLinks.push({ source: `domain:${a}`, target: `domain:${b}`, ltype: 'domain_link', weight: shared.length })
    }
  }
  return { byDomain, domainKeywords, domainLinks }
}

// ─── appendNodeVisuals ────────────────────────────────────────────────────────
function appendNodeVisuals(sel, connCount, theme, isNew = false) {
  // Subtle volumetric glow — smaller for live_memory
  sel.append('circle').attr('class', 'glow-vol')
    .attr('r', d => {
      if (d.type === 'live_memory') return nodeBaseR(d, connCount) * 2
      return nodeBaseR(d, connCount) * 3
    })
    .attr('fill', d => {
      if (d.type === 'domain')        return domainColors(d.domain).glow
      if (d.type === 'live_memory')   return d.clusterKey ? clusterColors(d.clusterKey).glow : domainColors(d.domain).glow
      if (d.type === 'claude_memory') return 'hsl(270,80%,60%)'
      const c = connCount.get(d.id) || 0
      return c >= 3 ? theme.nodeHigh : theme.nodeMid
    })
    .attr('opacity', isNew ? 0 : 0.04)
    .style('pointer-events', 'none')
    .transition().delay(isNew ? 300 : 0).duration(300).attr('opacity', 0.04)

  // Core circle
  const core = sel.append('circle').attr('class', 'main')
    .attr('fill', d => {
      if (d.type === 'domain')        return domainColors(d.domain).fill
      if (d.type === 'live_memory')   return d.clusterKey ? clusterColors(d.clusterKey).fill : domainColors(d.domain).urlFill
      if (d.type === 'claude_memory') return 'hsl(270,55%,18%)'
      const c = connCount.get(d.id) || 0
      return c >= 3 ? theme.nodeHigh : c >= 1 ? theme.nodeMid : theme.nodeLow
    })
    .attr('stroke', d => {
      if (d.type === 'live_memory')   return 'none'  // no border on leaf URL nodes
      if (d.type === 'domain')        return domainColors(d.domain).stroke
      if (d.type === 'claude_memory') return 'hsl(270,70%,55%)'
      return (connCount.get(d.id) || 0) >= 1 ? theme.nodeMid : 'transparent'
    })
    .attr('stroke-width', d => d.type === 'domain' ? 1.2 : 0.7)
    .attr('filter', d => {
      if (d.type === 'live_memory') return null  // no bloom on tiny URL nodes
      if (d.type === 'domain') return `url(#dglow-${d.domain.replace(/[^a-z0-9]/g, '-')})`
      const c = connCount.get(d.id) || 0
      return c >= 3 ? 'url(#bloom-strong)' : c >= 1 ? 'url(#bloom-soft)' : null
    })

  if (isNew) {
    core.attr('r', 0).attr('opacity', 0)
      .transition().duration(600).ease(d3.easeElasticOut.amplitude(1.1).period(0.42))
      .attr('r', d => nodeBaseR(d, connCount))
      .attr('opacity', 1)
  } else {
    core.attr('r', d => nodeBaseR(d, connCount))
  }

  // Label — hidden for live_memory by default, shown on hover
  sel.append('text').attr('class', 'lbl')
    .text(d => {
      if (d.type === 'domain') return d.domain
      if (d.type === 'live_memory') { const t = d.title || d.domain || ''; return t.length > 22 ? t.slice(0, 20) + '…' : t }
      const t = d.title || ''; return t.length > 16 ? t.slice(0, 14) + '…' : t
    })
    .attr('dy', d => nodeBaseR(d, connCount) + 8)
    .attr('text-anchor', 'middle')
    .attr('fill', d => {
      if (d.type === 'domain')        return domainColors(d.domain).label
      if (d.type === 'live_memory')   return domainColors(d.domain).label
      if (d.type === 'claude_memory') return 'hsl(270,70%,72%)'
      return (connCount.get(d.id) || 0) >= 1 ? theme.labelHigh : theme.label
    })
    .attr('font-size', d => d.type === 'domain' ? '8px' : '7px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .style('pointer-events', 'none')
    .attr('opacity', d => d.type === 'live_memory' ? 0 : (isNew ? 0 : 1))
    .transition().delay(isNew ? 500 : 0).duration(400)
    .attr('opacity', d => d.type === 'live_memory' ? 0 : 1)
}

// ─── attachNodeInteractions ───────────────────────────────────────────────────
function attachNodeInteractions(sel, sim, connCount, stateRef) {
  sel.attr('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.05).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    )
    .on('click', (_, d) => {
      const st = stateRef.current
      if (d.type === 'note' && st.setActiveNote) st.setActiveNote(d.id)
      triggerSynapticWave(d, stateRef)
    })
    .on('dblclick', (_, d) => { if (d.type === 'live_memory') window.open(d.url, '_blank', 'noopener') })
    .on('mouseover', function(_, d) {
      const r = nodeBaseR(d, connCount)
      d3.select(this).select('.main').transition().duration(100).attr('r', r * 1.7)
      d3.select(this).select('.glow-vol').transition().duration(100).attr('opacity', 0.25).attr('r', r * 6)
      if (d.type === 'live_memory') d3.select(this).select('.lbl').transition().duration(120).attr('opacity', 1)
    })
    .on('mouseout', function(_, d) {
      const r = nodeBaseR(d, connCount)
      d3.select(this).select('.main').transition().duration(220).attr('r', r)
      d3.select(this).select('.glow-vol').transition().duration(220)
        .attr('opacity', 0.05)
        .attr('r', d.type === 'live_memory' ? r * 2.5 : r * 4)
      if (d.type === 'live_memory') d3.select(this).select('.lbl').transition().duration(200).attr('opacity', 0)
    })
}

// ─── Synaptic wave ────────────────────────────────────────────────────────────
function triggerSynapticWave(node, stateRef) {
  const st = stateRef.current
  const { allNodes, allLinks, nodeG, connCount, theme } = st
  if (!nodeG || !allNodes || !allLinks) return

  const adjacency = new Map(allNodes.map(n => [n.id, []]))
  allLinks.forEach(l => {
    const sid = typeof l.source === 'object' ? l.source.id : l.source
    const tid = typeof l.target === 'object' ? l.target.id : l.target
    if (adjacency.has(sid)) adjacency.get(sid).push(tid)
    if (adjacency.has(tid)) adjacency.get(tid).push(sid)
  })

  const visited  = new Set([node.id])
  let   frontier = [node.id], depth = 0

  const wave = () => {
    if (!frontier.length || depth > 4) return
    const next = []
    frontier.forEach(nid => {
      nodeG.selectAll('g').filter(n => n.id === nid).each(function(nd) {
        const r = nodeBaseR(nd, connCount)
        const targetColor = nd.type === 'domain' ? domainColors(nd.domain).fill
          : nd.type === 'live_memory' ? domainColors(nd.domain).urlFill
          : (connCount.get(nd.id) || 0) >= 3 ? (theme?.nodeHigh || '#00ffff')
          : (connCount.get(nd.id) || 0) >= 1 ? (theme?.nodeMid  || '#00b8d9')
          : (theme?.nodeLow || '#003d4d')
        d3.select(this).select('.main')
          .transition().duration(140).attr('r', r * 3).attr('fill', '#ffffff')
          .transition().duration(500).ease(d3.easeQuadOut).attr('r', r).attr('fill', targetColor)
        d3.select(this).select('.glow-vol')
          .transition().duration(140).attr('opacity', 0.6).attr('r', r * 7)
          .transition().duration(500).attr('opacity', 0.05)
          .attr('r', nd.type === 'live_memory' ? r * 2.5 : r * 4)
      })
      ;(adjacency.get(nid) || []).forEach(nb => {
        if (!visited.has(nb)) { visited.add(nb); next.push(nb) }
      })
    })
    frontier = next; depth++
    setTimeout(wave, 150)
  }
  wave()
}

// ─── FilterChip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, onChange, color }) {
  return (
    <button
      onClick={() => onChange(v => !v)}
      style={{
        padding: '4px 10px', borderRadius: 5, fontSize: 11,
        border: `1px solid ${active ? color + '66' : 'rgba(100,100,130,0.3)'}`,
        background: active ? color + '18' : 'transparent',
        color: active ? color : 'rgba(100,100,130,0.6)',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'JetBrains Mono, monospace',
        boxShadow: active ? `0 0 6px ${color}33` : 'none',
      }}
    >{label}</button>
  )
}

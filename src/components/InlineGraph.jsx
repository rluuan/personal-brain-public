import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useNotesStore } from '../store/useNotesStore'

const THEMES = {
  neural: {
    name: 'Neural',
    bg: '#060612',
    noteLow: '#1e1b4b', noteMid: '#4f46e5', noteHigh: '#a855f7',
    linkNote: '#6366f1', linkDomainDomain: '#22d3ee',
    particle: '#86efac',
    label: '#475569', labelHigh: '#c4b5fd',
    border: '#1e1b4b',
    panelFill: '#06b6d411', panelStroke: '#06b6d455', panelLabel: '#67e8f9',
  },
  synthwave: {
    name: 'Synthwave',
    bg: '#0d001a',
    noteLow: '#200035', noteMid: '#7c3aed', noteHigh: '#ec4899',
    linkNote: '#7c3aed', linkDomainDomain: '#e879f9',
    particle: '#ff80ff',
    label: '#9f7aea', labelHigh: '#f9a8d4',
    border: '#2d0050',
    panelFill: '#a855f711', panelStroke: '#a855f755', panelLabel: '#d8b4fe',
  },
  matrix: {
    name: 'Matrix',
    bg: '#000d00',
    noteLow: '#001400', noteMid: '#16a34a', noteHigh: '#4ade80',
    linkNote: '#16a34a', linkDomainDomain: '#4ade80',
    particle: '#a7f3d0',
    label: '#4ade80', labelHigh: '#bbf7d0',
    border: '#0a1f0a',
    panelFill: '#22c55e11', panelStroke: '#22c55e55', panelLabel: '#86efac',
  },
}

// ─── Domain color (unique per domain via hash) ────────────────────────────────
function hashDomain(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(33, h) ^ str.charCodeAt(i)) >>> 0
  return h
}

// Returns { fill, stroke, glow, label, linkColor } for a domain
function domainColors(domain) {
  const hue = hashDomain(domain) % 360
  return {
    fill:      `hsl(${hue},65%,28%)`,
    stroke:    `hsl(${hue},80%,60%)`,
    glow:      `hsl(${hue},90%,55%)`,
    label:     `hsl(${hue},75%,70%)`,
    urlFill:   `hsl(${hue},50%,18%)`,
    urlStroke: `hsl(${hue},60%,40%)`,
    link:      `hsl(${hue},70%,50%)`,
  }
}

// ─── URL helpers ──────────────────────────────────────────────────────────────
function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'unknown' }
}

const STOP = new Set([
  'http','https','www','com','net','org','the','and','for','are','was','not','you','all','can',
  'has','his','how','its','new','see','who','did','does','from','into','some','than','that',
  'them','then','they','this','with','have','been','will','your','more','when','what','time',
  'very','over','such','just','like','only','also','most','both','each','much','after','about',
  'html','page','home','news','blog','site','web','read','more','2024','2025','2026',
])
function extractKeywords(text) {
  return [...new Set(
    (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter(w => w.length >= 4 && !STOP.has(w))
  )]
}

// ─── Build graph data from liveMemories ───────────────────────────────────────
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

// ─── Node radius ──────────────────────────────────────────────────────────────
function nodeR(d, connCount) {
  if (d.type === 'domain')      return 6 + Math.min((connCount.get(d.id) || 0) * 0.35, 5)
  if (d.type === 'live_memory') return 3.5
  return 4 + Math.min((connCount.get(d.id) || 0) * 1.5, 7)
}

// ─── Interactions ─────────────────────────────────────────────────────────────
function attachNode(sel, sim, connCount, theme, setActiveNote) {
  sel
    .attr('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.04).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    )
    .on('click',   (_, d) => { if (d.type === 'note') setActiveNote(d.id) })
    .on('dblclick',(_, d) => { if (d.type === 'live_memory') window.open(d.url, '_blank', 'noopener') })
    .on('mouseover', function(_, d) {
      const r = nodeR(d, connCount)
      d3.select(this).select('.main').transition().duration(100).attr('r', r * 1.35).attr('stroke-width', 2)
      if (d.type === 'live_memory')
        d3.select(this).select('.lbl').transition().duration(120).attr('opacity', 1)
    })
    .on('mouseout', function(_, d) {
      d3.select(this).select('.main').transition().duration(180)
        .attr('r', nodeR(d, connCount)).attr('stroke-width', d.type === 'domain' ? 1.5 : 1)
      if (d.type === 'live_memory')
        d3.select(this).select('.lbl').transition().duration(200).attr('opacity', 0)
    })
}

// ─── Append node visuals ──────────────────────────────────────────────────────
function appendNodeVisuals(sel, connCount, theme, isNew = false) {
  const circ = sel.append('circle').attr('class', 'main')
    .attr('fill', d => {
      if (d.type === 'domain')      return domainColors(d.domain).fill
      if (d.type === 'live_memory') return domainColors(d.domain).urlFill
      const c = connCount.get(d.id) || 0
      return c >= 3 ? theme.noteHigh : c >= 1 ? theme.noteMid : theme.noteLow
    })
    .attr('stroke', d => {
      if (d.type === 'domain')      return domainColors(d.domain).stroke
      if (d.type === 'live_memory') return domainColors(d.domain).urlStroke
      return (connCount.get(d.id) || 0) >= 1 ? theme.noteMid : 'transparent'
    })
    .attr('stroke-width', d => d.type === 'domain' ? 1.5 : 1)
    .attr('filter', d => {
      if (d.type === 'domain') return `url(#glow-${d.domain.replace(/[^a-z0-9]/g,'-')})`
      if ((connCount.get(d.id) || 0) >= 1) return 'url(#glow-note)'
      return null
    })

  if (isNew) {
    circ.attr('r', 0)
      .transition().duration(600).ease(d3.easeElasticOut.amplitude(1).period(0.4))
      .attr('r', d => nodeR(d, connCount))
  } else {
    circ.attr('r', d => nodeR(d, connCount))
  }

  sel.append('text').attr('class', 'lbl')
    .text(d => {
      if (d.type === 'domain') return d.domain
      if (d.type === 'live_memory') {
        const t = d.title || d.domain || ''
        return t.length > 20 ? t.slice(0, 18) + '…' : t
      }
      const t = d.title || ''
      return t.length > 15 ? t.slice(0, 13) + '…' : t
    })
    .attr('dy', d => nodeR(d, connCount) + 10)
    .attr('text-anchor', 'middle')
    .attr('fill', d => {
      if (d.type === 'domain')      return domainColors(d.domain).label
      if (d.type === 'live_memory') return domainColors(d.domain).label
      return (connCount.get(d.id) || 0) >= 1 ? theme.labelHigh : theme.label
    })
    .attr('font-size', d => d.type === 'domain' ? '8.5px' : '7px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .style('pointer-events', 'none')
    .attr('opacity', d => {
      if (d.type === 'live_memory') return 0      // hidden until hover
      return isNew ? 0 : 1
    })
    .transition().delay(isNew ? 400 : 0).duration(400)
    .attr('opacity', d => d.type === 'live_memory' ? 0 : 1)
}

// ─────────────────────────────────────────────────────────────────────────────
export default function InlineGraph() {
  const svgRef   = useRef(null)
  const stateRef = useRef({
    sim: null, g: null, nodeG: null, linkG: null,
    lmIds: new Set(), domainNodes: new Map(),
    domainKeywords: new Map(), particleInterval: null,
  })
  const [themeName, setThemeName] = useState('neural')

  const { notes, setActiveNote, getLinks, fetchLiveMemories, user } = useNotesStore()
  const liveMemories = useNotesStore(state => state.liveMemories)

  useEffect(() => { if (user) fetchLiveMemories({ limit: 500 }) }, [user])

  // ── Full rebuild ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const st = stateRef.current
    if (st.sim) { st.sim.stop(); st.sim = null }
    if (st.particleInterval) { clearInterval(st.particleInterval); st.particleInterval = null }
    st.lmIds = new Set()
    st.domainNodes = new Map()
    st.domainKeywords = new Map()

    const theme  = THEMES[themeName]
    const width  = el.clientWidth  || 800
    const height = el.clientHeight || 500
    const cx = width / 2, cy = height / 2
    const maxR = Math.min(width, height) * 0.43

    // Live Memory panel radius (visual only) — extra padding so nodes don't hug the border
    const panelR = maxR * 0.52

    // Domain ring radius — kept smaller so there's always space between nodes and panel edge
    const domainR = panelR * 0.38

    // ── Build live graph ─────────────────────────────────────────────────────
    const { byDomain, domainKeywords, domainLinks } = buildLiveGraph(liveMemories)

    // ── Build nodes & links ──────────────────────────────────────────────────
    const domainNodeList = []
    const urlNodeList    = []
    const allLinks       = []

    byDomain.forEach((urls, domain) => {
      const domId  = `domain:${domain}`
      const domNode = { id: domId, domain, title: domain, type: 'domain' }
      domainNodeList.push(domNode)
      st.domainNodes.set(domain, domNode)

      urls.forEach(m => {
        st.lmIds.add(m.id)
        urlNodeList.push({ id: m.id, title: m.title || domain, url: m.url, domain, type: 'live_memory' })
        allLinks.push({ source: m.id, target: domId, ltype: 'url_to_domain' })
      })
    })
    st.domainKeywords = domainKeywords
    domainLinks.forEach(l => allLinks.push(l))

    // Note nodes
    const sortedNotes = [...notes].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    const noteNodes = sortedNotes.map((n, i) => ({
      id: n.id, title: n.title, type: 'note', content: n.content, sortIdx: i,
    }))
    const nodeMap = new Map(notes.map(n => [n.title?.toLowerCase(), n]))
    notes.forEach(note => {
      getLinks(note.content || '').forEach(title => {
        const target = nodeMap.get(title.toLowerCase())
        if (target) allLinks.push({ source: note.id, target: target.id, ltype: 'note' })
      })
    })

    const allNodes = [...domainNodeList, ...urlNodeList, ...noteNodes]

    // ── Connection count ─────────────────────────────────────────────────────
    const connCount = new Map(allNodes.map(n => [n.id, 0]))
    allLinks.forEach(l => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source
      const tid = typeof l.target === 'object' ? l.target.id : l.target
      if (connCount.has(sid)) connCount.set(sid, (connCount.get(sid) || 0) + 1)
      if (connCount.has(tid)) connCount.set(tid, (connCount.get(tid) || 0) + 1)
    })

    // ── Note layout ──────────────────────────────────────────────────────────
    const connectedNotes = noteNodes.filter(n => (connCount.get(n.id) || 0) > 0)
    const isolatedNotes  = noteNodes.filter(n => (connCount.get(n.id) || 0) === 0)
    const noteInnerR = panelR + maxR * 0.08
    const noteOuterR = maxR * 0.92
    connectedNotes.forEach((n, i) => {
      const r = connectedNotes.length > 1 ? i / (connectedNotes.length - 1) : 0.5
      n.targetR = noteInnerR + r * (noteOuterR - noteInnerR)
    })
    isolatedNotes.forEach(n => { n.isolated = true })
    const isoCx = cx + maxR * 0.6
    const isoCy = cy - maxR * 0.55

    // Spread domain nodes in initial positions around center ring
    domainNodeList.forEach((n, i) => {
      const angle = (i / Math.max(domainNodeList.length, 1)) * Math.PI * 2
      n.x = cx + Math.cos(angle) * domainR
      n.y = cy + Math.sin(angle) * domainR
    })

    // ── D3 setup ─────────────────────────────────────────────────────────────
    d3.select(el).selectAll('*').remove()
    const svg = d3.select(el).attr('width', width).attr('height', height)

    // ── Defs: glows per domain + notes ───────────────────────────────────────
    const defs = svg.append('defs')
    const addGlow = (id, color, blur) => {
      const f = defs.append('filter').attr('id', id)
        .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%')
      f.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', blur).attr('result', 'blur')
      f.append('feFlood').attr('flood-color', color).attr('flood-opacity', 1).attr('result', 'col')
      f.append('feComposite').attr('in', 'col').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow')
      const m = f.append('feMerge')
      m.append('feMergeNode').attr('in', 'glow')
      m.append('feMergeNode').attr('in', 'SourceGraphic')
    }
    // One glow filter per unique domain
    byDomain.forEach((_, domain) => {
      addGlow(`glow-${domain.replace(/[^a-z0-9]/g,'-')}`, domainColors(domain).glow, 5)
    })
    addGlow('glow-note', theme.noteMid, 3)

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.1, 6]).on('zoom', e => g.attr('transform', e.transform)))

    // ── Live Memory panel (visual backdrop) ──────────────────────────────────
    g.append('circle')
      .attr('cx', cx).attr('cy', cy).attr('r', panelR)
      .attr('fill', theme.panelFill)
      .attr('stroke', theme.panelStroke)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4')
      .style('pointer-events', 'none')

    g.append('text')
      .attr('x', cx).attr('y', cy - panelR + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.panelLabel)
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('opacity', 0.7)
      .style('pointer-events', 'none')
      .text('live memory')

    // ── Simulation ───────────────────────────────────────────────────────────
    const sim = d3.forceSimulation(allNodes)
      .alphaDecay(0.009)
      .velocityDecay(0.55)
      .force('link', d3.forceLink(allLinks).id(d => d.id)
        .distance(d => {
          if (d.ltype === 'url_to_domain') return 55
          if (d.ltype === 'domain_link')   return 110
          return 80
        })
        .strength(d => {
          if (d.ltype === 'url_to_domain') return 0.75
          if (d.ltype === 'domain_link')   return 0.25
          return 0.65
        }))
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'domain')      return -160
        if (d.type === 'live_memory') return -30
        if (d.isolated)               return -12
        return -110
      }))
      .force('collision', d3.forceCollide(d => {
        if (d.type === 'domain')      return 14
        if (d.type === 'live_memory') return 6
        return 11
      }))
      .force('radial', d3.forceRadial(d => {
        if (d.type === 'domain')      return domainR
        if (d.type === 'live_memory') return 0
        if (d.isolated)               return 0
        return d.targetR
      }, cx, cy).strength(d => {
        if (d.type === 'domain')      return 0.55
        if (d.type === 'live_memory') return 0
        if (d.isolated)               return 0
        return 0.45
      }))
      // Keep live_memory nodes inside the panel (soft boundary)
      .force('lm-bound-x', d3.forceX(cx).strength(d => d.type === 'live_memory' ? 0.08 : 0))
      .force('lm-bound-y', d3.forceY(cy).strength(d => d.type === 'live_memory' ? 0.08 : 0))
      .force('iso-x', d3.forceX(d => d.isolated ? isoCx : cx).strength(d => d.isolated ? 0.4 : 0))
      .force('iso-y', d3.forceY(d => d.isolated ? isoCy : cy).strength(d => d.isolated ? 0.4 : 0))

    // ── Links ────────────────────────────────────────────────────────────────
    const linkG = g.append('g').attr('class', 'links')
    linkG.selectAll('path').data(allLinks).join('path')
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.ltype === 'url_to_domain') {
          const dom = typeof d.source === 'object' ? d.source.domain : null
          return dom ? domainColors(dom).link : '#888'
        }
        if (d.ltype === 'domain_link') return theme.linkDomainDomain
        return theme.linkNote
      })
      .attr('stroke-width', d => d.ltype === 'domain_link' ? 1 : 0.7)
      .attr('stroke-opacity', d => {
        if (d.ltype === 'url_to_domain') return 0.2
        if (d.ltype === 'domain_link')   return 0.45
        return 0.45
      })
      .attr('stroke-dasharray', d => d.ltype === 'url_to_domain' ? '2,3' : null)

    // ── Nodes ────────────────────────────────────────────────────────────────
    const nodeG = g.append('g').attr('class', 'nodes')
    const nodeGrp = nodeG.selectAll('g').data(allNodes, d => d.id).join('g')
    appendNodeVisuals(nodeGrp, connCount, theme, false)
    attachNode(nodeGrp, sim, connCount, theme, setActiveNote)

    // Store refs
    st.sim = sim; st.g = g; st.nodeG = nodeG; st.linkG = linkG
    st.allNodes = allNodes; st.allLinks = allLinks; st.connCount = connCount
    st.theme = theme; st.setActiveNote = setActiveNote
    st.cx = cx; st.cy = cy; st.domainR = domainR; st.panelR = panelR
    st.isoCx = isoCx; st.isoCy = isoCy

    // ── Particles on note links ───────────────────────────────────────────────
    const noteLinks = allLinks.filter(l => l.ltype === 'note')
    if (noteLinks.length > 0) {
      st.particleInterval = setInterval(() => {
        const l = noteLinks[Math.floor(Math.random() * noteLinks.length)]
        g.append('circle').attr('r', 1.5).attr('fill', theme.particle).style('pointer-events', 'none')
          .transition().duration(1300 + Math.random() * 1400).ease(d3.easeLinear)
          .tween('travel', function() {
            return t => {
              const sx = l.source.x || 0, sy = l.source.y || 0
              const tx = l.target.x || 0, ty = l.target.y || 0
              const mx = (sx + tx) / 2 + (ty - sy) * 0.25, my = (sy + ty) / 2 - (tx - sx) * 0.25
              d3.select(this)
                .attr('cx', (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*tx)
                .attr('cy', (1-t)*(1-t)*sy + 2*(1-t)*t*my + t*t*ty)
                .attr('opacity', Math.sin(t * Math.PI) * 0.9)
            }
          })
          .on('end', function() { d3.select(this).remove() })
      }, 480)
    }

    // ── Tick ─────────────────────────────────────────────────────────────────
    sim.on('tick', () => {
      linkG.selectAll('path').attr('d', d => {
        const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
        const mx = (sx + tx) / 2 + (ty - sy) * 0.18, my = (sy + ty) / 2 - (tx - sx) * 0.18
        return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`
      })
      nodeG.selectAll('g').attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => {
      sim.stop()
      if (st.particleInterval) { clearInterval(st.particleInterval); st.particleInterval = null }
    }
  }, [notes, themeName])

  // ── Incremental LM insert ──────────────────────────────────────────────────
  useEffect(() => {
    const st = stateRef.current
    if (!st.sim || !st.nodeG) return

    const newItems = liveMemories.filter(m => !st.lmIds.has(m.id))
    if (newItems.length === 0) return

    newItems.forEach(m => {
      st.lmIds.add(m.id)
      const theme  = st.theme
      const domain = getDomain(m.url)
      const domId  = `domain:${domain}`
      let domNode  = st.domainNodes.get(domain)

      if (!domNode) {
        domNode = {
          id: domId, domain, title: domain, type: 'domain',
          x: st.cx + (Math.random() - 0.5) * st.domainR * 2,
          y: st.cy + (Math.random() - 0.5) * st.domainR * 2,
        }
        st.domainNodes.set(domain, domNode)
        st.allNodes.push(domNode)
        st.connCount.set(domId, 0)

        const newWords = new Set(extractKeywords(m.title + ' ' + m.url))
        st.domainKeywords.set(domain, newWords)

        // Check keyword overlap with existing domains
        st.domainKeywords.forEach((words, other) => {
          if (other === domain) return
          const shared = [...words].filter(w => newWords.has(w))
          if (shared.length >= 2) {
            const dl = { source: domId, target: `domain:${other}`, ltype: 'domain_link', weight: shared.length }
            st.allLinks.push(dl)
            st.linkG.append('path').datum(dl)
              .attr('fill', 'none').attr('stroke', theme.linkDomainDomain)
              .attr('stroke-width', 1).attr('stroke-opacity', 0)
              .transition().delay(500).duration(600).attr('stroke-opacity', 0.45)
          }
        })

        st.sim.nodes(st.allNodes)
        const domGrp = st.nodeG.append('g').datum(domNode).attr('transform', `translate(${domNode.x},${domNode.y})`)
        appendNodeVisuals(d3.select(domGrp.node()), st.connCount, theme, true)
        attachNode(d3.select(domGrp.node()), st.sim, st.connCount, theme, st.setActiveNote)
      } else {
        const existing = st.domainKeywords.get(domain) || new Set()
        extractKeywords(m.title + ' ' + m.url).forEach(w => existing.add(w))
        st.domainKeywords.set(domain, existing)
      }

      const newNode = {
        id: m.id, title: m.title || domain, url: m.url, domain, type: 'live_memory',
        x: domNode.x + (Math.random() - 0.5) * 30,
        y: domNode.y + (Math.random() - 0.5) * 30,
      }
      const newLink = { source: m.id, target: domId, ltype: 'url_to_domain' }

      st.allNodes.push(newNode)
      st.allLinks.push(newLink)
      st.connCount.set(m.id, 1)
      st.connCount.set(domId, (st.connCount.get(domId) || 0) + 1)

      st.sim.nodes(st.allNodes)
      st.sim.force('link').links(st.allLinks)

      const dc = domainColors(domain)
      st.linkG.append('path').datum(newLink)
        .attr('fill', 'none').attr('stroke', dc.link)
        .attr('stroke-width', 0.7).attr('stroke-opacity', 0).attr('stroke-dasharray', '2,3')
        .transition().delay(300).duration(600).attr('stroke-opacity', 0.2)

      const grp = st.nodeG.append('g').datum(newNode).attr('transform', `translate(${newNode.x},${newNode.y})`)
      appendNodeVisuals(d3.select(grp.node()), st.connCount, st.theme, true)
      attachNode(d3.select(grp.node()), st.sim, st.connCount, st.theme, st.setActiveNote)

      st.sim.alpha(Math.max(st.sim.alpha(), 0.25)).restart()
    })
  }, [liveMemories])

  const theme = THEMES[themeName]

  return (
    <div className="w-full h-full flex flex-col" style={{ background: theme.bg }}>
      <div className="px-4 py-1.5 text-xs flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${theme.border}`, color: theme.label }}>
        <span style={{ fontSize: 13 }}>🕸</span>
        <span>{notes.length} notas · {liveMemories.length} links</span>
        <span style={{ opacity: 0.4 }}>· Arraste · Scroll · Click = nota · Duplo = link</span>
        <div className="flex gap-1 ml-auto">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => setThemeName(key)} style={{
              padding: '2px 10px', borderRadius: 4, fontSize: 10,
              border: `1px solid ${themeName === key ? theme.panelStroke : theme.border}`,
              background: themeName === key ? theme.panelFill : 'transparent',
              color: themeName === key ? theme.panelLabel : theme.label,
              cursor: 'pointer', transition: 'all 0.15s',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{t.name}</button>
          ))}
        </div>
      </div>
      <svg ref={svgRef} className="flex-1 w-full" />
    </div>
  )
}

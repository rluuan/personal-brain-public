import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useNotesStore } from '../store/useNotesStore'

export default function InlineGraph() {
  const svgRef = useRef(null)
  const { notes, setActiveNote, getLinks } = useNotesStore()

  useEffect(() => {
    const el = svgRef.current
    if (!el) return

    const width = el.clientWidth || 600
    const height = el.clientHeight || 400

    const nodeMap = new Map(notes.map((n) => [n.title.toLowerCase(), n]))
    const nodes = notes.map((n) => ({ id: n.id, title: n.title }))
    const links = []

    notes.forEach((note) => {
      getLinks(note.content).forEach((title) => {
        const target = nodeMap.get(title.toLowerCase())
        if (target) links.push({ source: note.id, target: target.id })
      })
    })

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el).attr('width', width).attr('height', height)
    const g = svg.append('g')

    svg.call(
      d3.zoom().scaleExtent([0.3, 4]).on('zoom', (e) => g.attr('transform', e.transform))
    )

    const sim = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(24))

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#313244').attr('stroke-width', 1.2).attr('stroke-opacity', 0.7)

    const connectionCount = new Map(nodes.map((n) => [n.id, 0]))
    links.forEach((l) => {
      const sid = typeof l.source === 'object' ? l.source.id : l.source
      const tid = typeof l.target === 'object' ? l.target.id : l.target
      connectionCount.set(sid, (connectionCount.get(sid) || 0) + 1)
      connectionCount.set(tid, (connectionCount.get(tid) || 0) + 1)
    })

    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on('click', (e, d) => setActiveNote(d.id))

    node.append('circle')
      .attr('r', (d) => 7 + Math.min((connectionCount.get(d.id) || 0) * 2, 10))
      .attr('fill', (d) => {
        const c = connectionCount.get(d.id) || 0
        return c >= 3 ? '#cba6f7' : c >= 1 ? '#89b4fa' : '#45475a'
      })
      .attr('stroke', '#0d0d1a').attr('stroke-width', 2)

    node.on('mouseover', function () {
      d3.select(this).select('circle').attr('stroke', '#cba6f7').attr('stroke-width', 3)
    }).on('mouseout', function () {
      d3.select(this).select('circle').attr('stroke', '#0d0d1a').attr('stroke-width', 2)
    })

    node.append('text')
      .text((d) => d.title.length > 16 ? d.title.slice(0, 14) + '…' : d.title)
      .attr('dy', (d) => 12 + Math.min((connectionCount.get(d.id) || 0) * 2, 10))
      .attr('text-anchor', 'middle')
      .attr('fill', '#a6adc8')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .style('pointer-events', 'none')

    sim.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    let particleInterval = null
    if (links.length > 0) {
      particleInterval = setInterval(() => {
        const l = links[Math.floor(Math.random() * links.length)]
        
        const particle = g.append('circle')
          .attr('r', 2)
          .attr('fill', '#a6e3a1')
          .style('pointer-events', 'none')

        particle.transition()
          .duration(1500 + Math.random() * 1500)
          .ease(d3.easeLinear)
          .tween('pathTween', function() {
            return function(t) {
              const x = l.source.x + (l.target.x - l.source.x) * t
              const y = l.source.y + (l.target.y - l.source.y) * t
              // Fade in (começo) e fade out (fim)
              const op = Math.sin(t * Math.PI)
              d3.select(this)
                .attr('cx', x)
                .attr('cy', y)
                .attr('opacity', op)
            }
          })
          .on('end', function() { d3.select(this).remove() })
      }, 400)
    }

    return () => {
      sim.stop()
      if (particleInterval) clearInterval(particleInterval)
    }
  }, [notes])

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#0d0d1a' }}>
      <div className="px-4 py-1.5 text-ui-muted text-xs flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244' }}>
        <span>🕸</span>
        <span>{notes.length} notas · Arraste · Scroll para zoom · Clique para abrir</span>
      </div>
      <svg ref={svgRef} className="flex-1 w-full" />
    </div>
  )
}

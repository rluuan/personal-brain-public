import React, { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import * as d3 from 'd3'

export default function GraphView({ onClose }) {
  const svgRef = useRef(null)
  const { notes, setActiveNote, getLinks } = useNotesStore()

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Build graph data
    const nodeMap = new Map(notes.map((n) => [n.title.toLowerCase(), n]))
    const nodes = notes.map((n) => ({ id: n.id, title: n.title }))
    const links = []

    notes.forEach((note) => {
      const linked = getLinks(note.content)
      linked.forEach((title) => {
        const target = nodeMap.get(title.toLowerCase())
        if (target) {
          links.push({ source: note.id, target: target.id })
        }
      })
    })

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    // Zoom
    const g = svg.append('g')
    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(30))

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#313244')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)

    // Node groups
    const node = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node')
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )
      .on('click', (event, d) => {
        setActiveNote(d.id)
        onClose()
      })

    // Count connections per node
    const connectionCount = new Map(nodes.map((n) => [n.id, 0]))
    links.forEach((l) => {
      connectionCount.set(l.source.id || l.source, (connectionCount.get(l.source.id || l.source) || 0) + 1)
      connectionCount.set(l.target.id || l.target, (connectionCount.get(l.target.id || l.target) || 0) + 1)
    })

    // Circles
    node
      .append('circle')
      .attr('r', (d) => 8 + Math.min((connectionCount.get(d.id) || 0) * 2, 12))
      .attr('fill', (d) => {
        const count = connectionCount.get(d.id) || 0
        if (count >= 3) return '#cba6f7'
        if (count >= 1) return '#89b4fa'
        return '#45475a'
      })
      .attr('stroke', '#1e1e2e')
      .attr('stroke-width', 2)
      .style('transition', 'r 0.2s')

    node
      .on('mouseover', function (event, d) {
        d3.select(this).select('circle').attr('stroke', '#cba6f7').attr('stroke-width', 3)
      })
      .on('mouseout', function () {
        d3.select(this).select('circle').attr('stroke', '#1e1e2e').attr('stroke-width', 2)
      })

    // Labels
    node
      .append('text')
      .text((d) => d.title)
      .attr('dy', (d) => 14 + Math.min((connectionCount.get(d.id) || 0) * 2, 12))
      .attr('text-anchor', 'middle')
      .attr('fill', '#a6adc8')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [notes])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: '#161622' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-ui-accent">⬡</span>
          <span className="text-ui-text text-sm font-semibold">Grafo de Conhecimento</span>
          <span className="text-ui-muted text-xs">{notes.length} notas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ui-muted text-xs">Arraste para mover · Scroll para zoom · Clique para abrir nota</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" style={{ background: '#0d0d1a' }} />

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 p-3 rounded-lg text-xs text-ui-muted"
          style={{ background: 'rgba(22,22,34,0.9)', border: '1px solid #313244' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-ui-accent" />
            <span>Hub (3+ links)</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-ui-blue" />
            <span>Conectado (1-2 links)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#45475a' }} />
            <span>Isolado</span>
          </div>
        </div>
      </div>
    </div>
  )
}

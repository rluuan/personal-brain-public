import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, MousePointer2, Workflow, Type, Maximize2, Square, ArrowUpRight, Save, Check, AlertTriangle } from 'lucide-react'

// --- Constants ---
const COLORS = {
  accent: '#cba6f7',
  muted: '#6c7086',
  text: '#cdd6f4',
  border: '#45475a',
  nodeBg: 'rgba(30,30,46,0.95)',
  success: '#a6e3a1',
  warning: '#f9e2af'
}

const EDGE_SIZE = 12

export default function DiagramView({ data, onSave, activeTool = 'select', isEditable = true }) {
  const [nodes, setNodes] = useState(data.nodes || [])
  const [edges, setEdges] = useState(data.edges || [])
  const [selectedId, setSelectedId] = useState(null)
  const [editingTextId, setEditingTextId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [ghost, setGhost] = useState(null)
  const [panning, setPanning] = useState({ x: 0, y: 0, scale: 1 })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [hoverCursor, setHoverCursor] = useState('default')
  
  const canvasRef = useRef(null)
  const dataIdRef = useRef(data._id)

  // --- Synchronization & Persistence ---
  useEffect(() => {
    if (data._id !== dataIdRef.current) {
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
      setHasUnsavedChanges(false)
      setSelectedId(null)
      dataIdRef.current = data._id
    }
  }, [data])

  const handleSave = useCallback(() => {
    const payload = { ...data, nodes, edges }
    if (onSave) onSave(payload)
    setHasUnsavedChanges(false)
  }, [data, nodes, edges, onSave])

  const markChanged = () => setHasUnsavedChanges(true)

  // --- Helpers ---
  const getMousePos = (e) => {
    const canvas = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - canvas.left - panning.x) / panning.scale,
      y: (e.clientY - canvas.top - panning.y) / panning.scale
    }
  }

  const getResizeType = (node, pos) => {
    const x = pos.x; const y = pos.y
    const m = EDGE_SIZE / panning.scale
    const t = Math.abs(y - node.y) < m; const b = Math.abs(y - (node.y + node.height)) < m
    const l = Math.abs(x - node.x) < m; const r = Math.abs(x - (node.x + node.width)) < m
    if ((t && l) || (b && r)) return 'nwse-resize'
    if ((t && r) || (b && l)) return 'nesw-resize'
    if (t || b) return 'ns-resize'
    if (l || r) return 'ew-resize'
    return null
  }

  // --- Actions ---
  const deleteSelected = useCallback(() => {
    if (!selectedId || editingTextId) return
    const isNode = nodes.find(n => n.id === selectedId)
    let newNodes = nodes; let newEdges = edges
    if (isNode) {
      newNodes = nodes.filter(n => n.id !== selectedId)
      newEdges = edges.filter(e => e.fromId !== selectedId && e.toId !== selectedId)
    } else {
      newEdges = edges.filter(e => e.id !== selectedId)
    }
    setNodes(newNodes); setEdges(newEdges)
    markChanged(); setSelectedId(null)
  }, [selectedId, editingTextId, nodes, edges])

  // --- Zoom/Pan Control (Non-passive for preventDefault) ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.95 : 1.05
        setPanning(p => ({ ...p, scale: Math.min(3, Math.max(0.2, p.scale * delta)) }))
      }
    }
    
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  // --- Interaction ---
  const handleMouseDown = (e) => {
    if (!isEditable || editingTextId) return
    const pos = getMousePos(e)
    const hitNode = [...nodes].reverse().find(n => 
      pos.x >= n.x - EDGE_SIZE && pos.x <= n.x + n.width + EDGE_SIZE &&
      pos.y >= n.y - EDGE_SIZE && pos.y <= n.y + n.height + EDGE_SIZE
    )

    if (activeTool === 'rect') {
      setSelectedId(null)
      setDragging({ type: 'drawing-rect', startX: pos.x, startY: pos.y })
      setGhost({ type: 'rect', x: pos.x, y: pos.y, w: 0, h: 0 })
      return
    }

    if (hitNode) {
      if (activeTool === 'arrow') {
        setSelectedId(null)
        setDragging({ type: 'drawing-arrow', fromId: hitNode.id, startX: pos.x, startY: pos.y })
        setGhost({ type: 'arrow', x1: hitNode.x + hitNode.width/2, y1: hitNode.y + hitNode.height/2, x2: pos.x, y2: pos.y })
      } else {
        const m = EDGE_SIZE / panning.scale
        const edges = {
          t: Math.abs(pos.y - hitNode.y) < m,
          b: Math.abs(pos.y - (hitNode.y + hitNode.height)) < m,
          l: Math.abs(pos.x - hitNode.x) < m,
          r: Math.abs(pos.x - (hitNode.x + hitNode.width)) < m
        }
        const isResize = edges.t || edges.b || edges.l || edges.r
        setSelectedId(hitNode.id)
        setDragging({ type: isResize ? 'resize' : 'move', id: hitNode.id, edge: edges, startX: e.clientX, startY: e.clientY, origX: hitNode.x, origY: hitNode.y, origW: hitNode.width, origH: hitNode.height })
      }
    } else {
      setSelectedId(null)
      setDragging({ type: 'pan', startX: e.clientX, startY: e.clientY, origX: panning.x, origY: panning.y })
    }
  }

  const handleMouseMove = (e) => {
    const pos = getMousePos(e)
    if (!dragging) {
      const hit = [...nodes].reverse().find(n => pos.x >= n.x - EDGE_SIZE && pos.x <= n.x + n.width + EDGE_SIZE && pos.y >= n.y - EDGE_SIZE && pos.y <= n.y + n.height + EDGE_SIZE)
      if (hit && activeTool === 'select') setHoverCursor(getResizeType(hit, pos) || 'grab')
      else setHoverCursor(activeTool === 'rect' ? 'crosshair' : 'default')
      return
    }

    if (dragging.type === 'drawing-rect') {
      setGhost({ ...ghost, x: Math.min(pos.x, dragging.startX), y: Math.min(pos.y, dragging.startY), w: Math.abs(pos.x - dragging.startX), h: Math.abs(pos.y - dragging.startY) })
    } else if (dragging.type === 'drawing-arrow') {
      setGhost({ ...ghost, x2: pos.x, y2: pos.y })
    } else if (dragging.type === 'move') {
      const dx = (e.clientX - dragging.startX) / panning.scale
      const dy = (e.clientY - dragging.startY) / panning.scale
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: dragging.origX + dx, y: dragging.origY + dy } : n))
    } else if (dragging.type === 'resize') {
      const dx = (e.clientX - dragging.startX) / panning.scale
      const dy = (e.clientY - dragging.startY) / panning.scale
      const { t, b, l, r } = dragging.edge
      setNodes(prev => prev.map(n => {
        if (n.id !== dragging.id) return n
        let { x, y, width, height } = n
        if (l) { x = dragging.origX + dx; width = Math.max(40, dragging.origW - dx) }
        else if (r) { width = Math.max(40, dragging.origW + dx) }
        if (t) { y = dragging.origY + dy; height = Math.max(30, dragging.origH - dy) }
        else if (b) { height = Math.max(30, dragging.origH + dy) }
        return { ...n, x, y, width, height }
      }))
    } else if (dragging.type === 'pan') {
      setPanning(p => ({ ...p, x: dragging.origX + (e.clientX - dragging.startX), y: dragging.origY + (e.clientY - dragging.startY) }))
    }
  }

  const handleMouseUp = () => {
    if (!dragging) return
    if (dragging.type === 'drawing-rect' && ghost?.w > 10) {
      const newNode = { id: `node-${Date.now()}`, x: ghost.x, y: ghost.y, width: ghost.w, height: ghost.h, text: '' }
      setNodes([...nodes, newNode]); markChanged(); setSelectedId(newNode.id); setEditingTextId(newNode.id)
    } else if (dragging.type === 'drawing-arrow' && ghost) {
      const target = nodes.find(n => ghost.x2 >= n.x && ghost.x2 <= n.x + n.width && ghost.y2 >= n.y && ghost.y2 <= n.y + n.height)
      if (target && target.id !== dragging.fromId) {
        setEdges([...edges, { id: `edge-${Date.now()}`, fromId: dragging.fromId, toId: target.id }])
        markChanged()
      }
    } else if (dragging.type === 'move' || dragging.type === 'resize') {
      markChanged()
    }
    setDragging(null); setGhost(null)
  }

  // --- Key Listeners ---
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave() }
      if (e.key === 'Escape') { setDragging(null); setGhost(null); setSelectedId(null); setEditingTextId(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingTextId && selectedId) deleteSelected()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editingTextId, selectedId, handleSave, deleteSelected])

  return (
    <div className="inline-diagram-container w-full h-[550px] bg-[#0d0d1a] rounded-2xl border border-[#313244] relative overflow-hidden transition-all shadow-2xl"
      style={{ cursor: hoverCursor, willChange: 'contents' }}>
      <style>{`.diag-textarea::-webkit-scrollbar { display: none; } .diag-textarea { scrollbar-width: none; -ms-overflow-style: none; } .node-container { will-change: transform, left, top; }`}</style>

      {/* Save Button */}
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
        <button onClick={handleSave} disabled={!hasUnsavedChanges} className={`px-4 py-2.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all flex items-center gap-2 border ${hasUnsavedChanges ? 'bg-[#cba6f7] text-[#11111b] border-[#cba6f7] hover:scale-105 active:scale-95' : 'bg-[#181825] text-[#6c7086] border-[#313244] opacity-50 cursor-default'}`}>
          {hasUnsavedChanges ? <Save size={18} /> : <Check size={18} />}
          <span className="text-xs font-black tracking-widest">{hasUnsavedChanges ? 'SALVAR' : 'SALVO'}</span>
        </button>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-300 animate-pulse font-medium backdrop-blur-md">
            <AlertTriangle size={12} /> Salve antes de trocar de nota!
          </div>
        )}
      </div>

      <div ref={canvasRef} className="w-full h-full relative" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={() => setDragging(null)}>
        <div style={{ transform: `translate(${panning.x}px, ${panning.y}px) scale(${panning.scale})`, transformOrigin: '0 0' }} className="w-full h-full">
          <svg className="absolute inset-0 overflow-visible pointer-events-none opacity-80">
            <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto"><polygon points="0 0, 10 3.5, 0 7" fill={COLORS.border} /></marker></defs>
            {edges.map(edge => {
              const f = nodes.find(n => n.id === edge.fromId); const t = nodes.find(n => n.id === edge.toId)
              if (!f || !t) return null
              const x1 = f.x+f.width/2; const y1 = f.y+f.height/2; const x2 = t.x+t.width/2; const y2 = t.y+t.height/2
              const dx = x2-x1; const dy = y2-y1; const cp1x = x1+dx*0.4; const cp1y = y1; const cp2x = x2-dx*0.4; const cp2y = y2
              return (
                <g key={edge.id} onClick={(e) => { e.stopPropagation(); setSelectedId(edge.id) }} className="cursor-pointer pointer-events-auto">
                  <path d={`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`} stroke={selectedId === edge.id ? COLORS.accent : COLORS.border} strokeWidth={selectedId === edge.id ? 3 : 2} fill="none" markerEnd="url(#arrowhead)" />
                  <path d={`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`} stroke="transparent" strokeWidth={12} fill="none" />
                </g>
              )
            })}
            {ghost?.type === 'arrow' && <line x1={ghost.x1} y1={ghost.y1} x2={ghost.x2} y2={ghost.y2} stroke={COLORS.accent} strokeWidth="2" strokeDasharray="5" strokeLinecap="round" />}
          </svg>

          {nodes.map(node => (
            <div key={node.id} onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(node.id); setSelectedId(node.id) }}
              className={`node-container absolute rounded-xl border transition-[border,box-shadow,ring] duration-200 ${selectedId === node.id ? 'z-20 border-[#cba6f7] shadow-[0_0_30px_rgba(203,166,247,0.4)] ring-1 ring-[#cba6f7]/50' : 'z-10 border-[#45475a]'}`}
              style={{ left: node.x, top: node.y, width: node.width, height: node.height, background: COLORS.nodeBg, backdropFilter: 'blur(20px)' }}>
              <textarea autoFocus={editingTextId === node.id} value={node.text} onChange={(e) => { setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: e.target.value } : n)) }}
                onBlur={() => { setEditingTextId(null); markChanged() }} readOnly={editingTextId !== node.id} spellCheck={false}
                className="diag-textarea w-full h-full p-4 bg-transparent border-none outline-none resize-none text-ui-text text-sm font-medium leading-relaxed text-center flex items-center justify-center placeholder:opacity-10"
                placeholder="..." onMouseDown={(e) => editingTextId === node.id && e.stopPropagation()} />
              {editingTextId !== node.id && <div className="absolute inset-0 cursor-inherit pointer-events-auto" />}
            </div>
          ))}
          {ghost?.type === 'rect' && <div className="absolute border-2 border-dashed border-[#cba6f7] rounded-xl bg-[#cba6f7]/5 pointer-events-none" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }} />}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-3 bg-[#1e1e2e]/90 px-4 py-2 rounded-full text-[10px] text-[#a6adc8] border border-[#313244] backdrop-blur-md pointer-events-none select-none">
        <Workflow size={12} className="text-[#cba6f7]" /> <span className="font-extrabold uppercase pr-2 border-r border-[#313244] tracking-widest">{activeTool}</span>
        <span className="opacity-70 font-medium">V, R, S: Atalhos | Ctrl+S: Salvar | <span className="text-[#f9e2af]">Aperte SALVAR para persistir na nota</span></span>
      </div>
    </div>
  )
}

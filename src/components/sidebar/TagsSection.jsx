import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Hash, Palette } from 'lucide-react'
import { FOLDER_COLORS } from '../../utils/sidebarOptions'

function TagColorPicker({ tag, color, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <span ref={containerRef} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} className="opacity-0 group-hover/tag:opacity-100 transition-opacity" title="Cor da tag">
        <Palette size={9} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 grid grid-cols-8 gap-1 rounded-lg p-2 shadow-xl"
          style={{ background: 'rgba(var(--color-panel-rgb),0.98)', border: '1px solid var(--color-border-strong)', minWidth: 150 }}
        >
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(tag, color === c ? null : c); setOpen(false) }}
              className="w-4 h-4 rounded-full hover:scale-110 transition-transform"
              style={{ background: c, border: color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.15)' }}
              title={c}
            />
          ))}
        </div>
      )}
    </span>
  )
}

export function TagsSection({ tags, tagColors = {}, activeFilter, onSelect, onColorChange }) {
  const [open, setOpen] = useState(false)
  if (!tags || tags.length === 0) return null

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors rounded">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Hash size={11} /><span>Tags ({tags.length})</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1 font-mono">
          {tags.map((tag) => {
            const color = tagColors[tag]
            const isActive = activeFilter?.type === 'tag' && activeFilter.value === tag
            return (
              <span
                key={tag}
                className="group/tag tag-pill text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-all"
                style={{
                  background: isActive ? (color ? `${color}33` : 'rgba(203,166,247,0.25)') : (color ? `${color}1a` : 'rgba(var(--color-panel-rgb),0.4)'),
                  color: color || 'var(--color-primary)',
                  border: `1px solid ${color ? `${color}55` : 'rgba(203,166,247,0.2)'}`,
                }}
                onClick={() => onSelect(isActive ? null : tag)}
              >
                #{tag}
                <TagColorPicker tag={tag} color={color} onChange={onColorChange} />
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

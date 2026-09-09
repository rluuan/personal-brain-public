import React, { useState } from 'react'
import { ChevronDown, ChevronRight, CircleDot } from 'lucide-react'
import { STATUS_OPTIONS } from '../../utils/sidebarOptions'

export function StatusSection({ notes, activeFilter, onSelect }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid #313244' }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors rounded">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <CircleDot size={11} /><span>Status</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          {STATUS_OPTIONS.map((status) => {
            const count = notes.filter((n) => n.status === status.id).length
            const isActive = activeFilter?.type === 'status' && activeFilter.value === status.id
            return (
              <button
                key={status.id}
                onClick={() => onSelect(isActive ? null : status.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all"
                style={isActive ? { background: 'rgba(49,49,85,0.7)' } : {}}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: status.color }} />
                <span className={`flex-1 text-left truncate ${isActive ? 'text-ui-accent font-semibold' : 'text-ui-text'}`}>{status.label}</span>
                <span className="text-ui-muted text-[10px]">{count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react'

export function RecentNotes({ notes, activeNoteId, onSelect }) {
  const [open, setOpen] = useState(true)

  const recent = [...notes]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 7)

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}m atrás`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h atrás`
    return `${Math.floor(hrs / 24)}d atrás`
  }

  if (recent.length === 0) return null

  return (
    <div className="mt-0.5" style={{ borderTop: '1px solid #313244' }}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-2 py-2 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Clock size={11} />
        <span>Últimas atualizações</span>
      </button>
      {open && (
        <div className="pb-1">
          {recent.map(note => (
            <div
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-all mx-1 ${note.id === activeNoteId ? 'text-ui-accent' : 'text-ui-text hover:bg-ui-hover/50'}`}
              style={note.id === activeNoteId ? { background: 'rgba(49,49,85,0.7)' } : {}}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText size={10} className="flex-shrink-0 text-ui-muted" />
                <span className="truncate">{note.title}</span>
              </div>
              <span className="text-[10px] text-ui-muted flex-shrink-0">{timeAgo(note.updated_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
